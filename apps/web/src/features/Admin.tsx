import { useEffect, useState, useRef } from "react";
import {
  Category,
  Event,
  Point,
  Scenario,
  eventSchema,
  pointSchema,
  CUTOFF,
  MAX_DATE,
  MIN_DATE,
} from "../../../../packages/shared/src/model";
import { api, ApiError } from "../lib/api";
type Props = {
  scenario: Scenario;
  categories: Category[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
};
const forecast = () => ({
  estimated_start: null,
  estimated_end: null,
  description:
    "Human accountability, governance, escalation and auditing continue.",
  rationale: "",
  assumptions: "",
  confidence: "low" as const,
});
function blankEvent(cat: string): Event {
  return {
    id: "",
    title: "",
    kind: "verified_history",
    date_precision: "year",
    historical_date_start: "2000-01-01",
    historical_date_end: null,
    category_id: cat,
    summary: "",
    impact: "",
    technology_type: "other",
    status: "published",
    sources: [],
    links: [],
  };
}
const emptyPoint = (s: Scenario): Point => ({
  id: "",
  scenario_id: s,
  point_date: "2030-01-01",
  technology_index: 50,
  human_effort_index: 88,
  rationale: "",
});
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string | number;
  onChange: (s: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      {required ? " *" : ""}
      {type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      )}
    </label>
  );
}
export function Admin({ scenario, categories, onClose, onRefresh }: Props) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  const [tab, setTab] = useState<"events" | "points" | "data">("events"),
    [events, setEvents] = useState<Event[]>([]),
    [points, setPoints] = useState<Point[]>([]),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("title");
  const [event, setEvent] = useState<Event | null>(null),
    [point, setPoint] = useState<Point | null>(null),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState(""),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [importText, setImportText] = useState(""),
    [importPreview, setImportPreview] = useState<unknown>(null),
    [backups, setBackups] = useState<string[]>([]),
    [backup, setBackup] = useState(""),
    [newCategory, setNewCategory] = useState("");
  async function load() {
    const [e, p, b] = await Promise.all([
      api<{ items: Event[] }>("/events?limit=500"),
      api<Point[]>("/curve-points?scenario=" + scenario),
      api<string[]>("/admin/backups"),
    ]);
    setEvents(e.items);
    setPoints(p);
    setBackups(b);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [scenario]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const discard = () => !dirty || confirm("Discard unsaved changes?");
  const close = () => {
    if (discard()) onClose();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const focusable = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href]",
          ) || []),
        ].filter((el) => el.getClientRects().length);
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dirty]);
  async function run(fn: () => Promise<unknown>, refresh = true) {
    setBusy(true);
    setErrors({});
    setMessage("");
    try {
      await fn();
      if (refresh) {
        await load();
        await onRefresh();
      }
      setMessage("Saved successfully.");
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function editEvent(e: Event) {
    if (!discard()) return;
    setPoint(null);
    setEvent(structuredClone(e));
    setDirty(false);
    setErrors({});
    setPreview(false);
  }
  function editPoint(p: Point) {
    if (!discard()) return;
    setEvent(null);
    setPoint({ ...p });
    setDirty(false);
    setErrors({});
    setPreview(false);
  }
  function changeEvent(p: Partial<Event>) {
    setEvent((e) => (e ? { ...e, ...p } : e));
    setDirty(true);
    setPreview(false);
  }
  function changePoint(p: Partial<Point>) {
    setPoint((e) => (e ? { ...e, ...p } : e));
    setDirty(true);
  }
  async function save() {
    const value = event || point;
    if (!value) return;
    const input = { ...value, id: value.id || undefined };
    const validation = (event ? eventSchema : pointSchema).safeParse(input);
    if (!validation.success) {
      const err: Record<string, string[]> = {};
      for (const i of validation.error.issues) {
        const key = i.path.join(".");
        err[key] = [...(err[key] || []), i.message];
      }
      setErrors(err);
      setMessage("Check the fields below.");
      return;
    }
    const path = event ? "/events" : "/curve-points";
    const ok = await run(() =>
      api(
        path + (value.id ? "/" + value.id : ""),
        value.id ? "PATCH" : "POST",
        input,
      ),
    );
    if (ok) {
      setDirty(false);
      setEvent(null);
      setPoint(null);
    }
  }
  return (
    <div className="admin-backdrop">
      <section
        ref={dialog}
        className="admin"
        role="dialog"
        aria-modal="true"
        aria-label="Manage timeline"
      >
        <header className="admin-header">
          <div>
            <h2>Manage timeline</h2>
            <p>Local SQLite · historical cutoff {CUTOFF}</p>
          </div>
          <button onClick={close} aria-label="Close management">
            ×
          </button>
        </header>
        <nav className="tabs">
          {(["events", "points", "data"] as const).map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => {
                if (discard()) {
                  setTab(t);
                  setEvent(null);
                  setPoint(null);
                  setDirty(false);
                }
              }}
            >
              {t === "events"
                ? "Manage Events"
                : t === "points"
                  ? "Manage Curve Points"
                  : "Data & backups"}
            </button>
          ))}
        </nav>
        <div role="status" className="notice">
          {message}
        </div>
        {Object.entries(errors).length > 0 && (
          <div role="alert" className="validation">
            {Object.entries(errors).map(([k, v]) => (
              <p key={k}>
                <strong>{k}</strong>: {v.join(" · ")}
              </p>
            ))}
          </div>
        )}
        {tab !== "data" && (
          <div className="admin-layout">
            <section className="record-list">
              <div className="list-tools">
                <input
                  aria-label="Search records"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Sort records"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="title">Title / date</option>
                  <option value="date">Date / scenario</option>
                </select>
                <button
                  onClick={() =>
                    tab === "events"
                      ? editEvent(blankEvent(categories[0]?.id || ""))
                      : editPoint(emptyPoint(scenario))
                  }
                >
                  Add {tab === "events" ? "event" : "point"}
                </button>
              </div>
              {tab === "events"
                ? events
                    .filter((e) =>
                      (e.title + " " + e.status)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .sort((a, b) =>
                      sort === "title"
                        ? a.title.localeCompare(b.title)
                        : (
                            a.historical_date_start ||
                            a.forecasts?.[scenario].estimated_start ||
                            ""
                          ).localeCompare(
                            b.historical_date_start ||
                              b.forecasts?.[scenario].estimated_start ||
                              "",
                          ),
                    )
                    .map((e) => (
                      <article
                        key={e.id}
                        className={e.deleted_at ? "deleted" : ""}
                      >
                        <button
                          className="record-title"
                          onClick={() => editEvent(e)}
                        >
                          {e.title}
                        </button>
                        <small>
                          {e.kind.replaceAll("_", " ")} ·{" "}
                          {e.deleted_at ? "deleted" : e.status}
                        </small>
                        <div className="record-actions">
                          <button
                            onClick={() =>
                              editEvent({
                                ...structuredClone(e),
                                id: "",
                                title: e.title + " (copy)",
                              })
                            }
                          >
                            Duplicate
                          </button>
                          {e.deleted_at || e.status === "archived" ? (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(() =>
                                  api("/events/" + e.id + "/restore", "POST"),
                                )
                              }
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(() =>
                                  api("/events/" + e.id, "PATCH", {
                                    status: "archived",
                                  }),
                                )
                              }
                            >
                              Archive
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  "Soft-delete this event? It can be restored.",
                                )
                              )
                                void run(() =>
                                  api("/events/" + e.id, "DELETE"),
                                );
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                : points
                    .filter((p) =>
                      (
                        p.point_date +
                        " " +
                        (p.scenario_id || "shared") +
                        " " +
                        p.rationale
                      ).includes(search),
                    )
                    .sort((a, b) =>
                      sort === "title"
                        ? a.point_date.localeCompare(b.point_date)
                        : (a.scenario_id || "").localeCompare(
                            b.scenario_id || "",
                          ),
                    )
                    .map((p) => (
                      <article key={p.id}>
                        <button
                          className="record-title"
                          onClick={() => editPoint(p)}
                        >
                          {p.point_date} · {p.scenario_id || "shared history"}
                        </button>
                        <small>
                          Technology {p.technology_index} / Human{" "}
                          {p.human_effort_index}
                        </small>
                        <button
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Delete curve anchor? Essential anchors are protected.",
                              )
                            )
                              void run(() =>
                                api("/curve-points/" + p.id, "DELETE"),
                              );
                          }}
                        >
                          Delete
                        </button>
                      </article>
                    ))}
            </section>
            <section className="editor">
              {!event && !point && (
                <p>
                  Select a record or add one.
                  <br />
                  Events and curve points are edited independently.
                </p>
              )}
              {event && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <h3>{event.id ? "Edit" : "Add"} event</h3>
                  <Field
                    label="Title"
                    value={event.title}
                    required
                    onChange={(v) => changeEvent({ title: v })}
                  />
                  <label>
                    Kind
                    <select
                      aria-label="Kind"
                      value={event.kind}
                      onChange={(e) => {
                        const kind = e.target.value as Event["kind"];
                        changeEvent({
                          kind,
                          ...(kind === "future_forecast"
                            ? {
                                historical_date_start: null,
                                historical_date_end: null,
                                forecasts: event.forecasts || {
                                  baseline: forecast(),
                                  accelerated: forecast(),
                                },
                              }
                            : {
                                historical_date_start:
                                  event.historical_date_start || "2000-01-01",
                                forecasts: undefined,
                              }),
                        });
                      }}
                    >
                      <option value="verified_history">Verified history</option>
                      <option value="approximate_history">
                        Approximate history
                      </option>
                      <option value="observed_current">Observed current</option>
                      <option value="future_forecast">Future forecast</option>
                    </select>
                  </label>
                  <label>
                    Date precision
                    <select
                      aria-label="Date precision"
                      value={event.date_precision}
                      onChange={(e) =>
                        changeEvent({
                          date_precision: e.target
                            .value as Event["date_precision"],
                        })
                      }
                    >
                      {["day", "month", "year", "range"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  {event.kind !== "future_forecast" ? (
                    <>
                      <Field
                        label="Historical date (first day for month/year anchors)"
                        type="date"
                        value={event.historical_date_start || ""}
                        onChange={(v) =>
                          changeEvent({ historical_date_start: v || null })
                        }
                      />
                      {event.date_precision === "range" && (
                        <Field
                          label="Historical range end"
                          type="date"
                          value={event.historical_date_end || ""}
                          onChange={(v) =>
                            changeEvent({ historical_date_end: v || null })
                          }
                        />
                      )}
                    </>
                  ) : (
                    (["baseline", "accelerated"] as const).map((s) => {
                      const f = event.forecasts![s];
                      const update = (v: Partial<typeof f>) =>
                        changeEvent({
                          forecasts: {
                            ...event.forecasts!,
                            [s]: { ...f, ...v },
                          },
                        });
                      return (
                        <fieldset key={s}>
                          <legend>
                            {s.toUpperCase()} · illustrative assumption
                          </legend>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={f.estimated_start === null}
                              onChange={(e) =>
                                update({
                                  estimated_start: e.target.checked
                                    ? null
                                    : "2030-01-01",
                                  estimated_end: null,
                                })
                              }
                            />
                            Not forecast
                          </label>
                          {f.estimated_start !== null && (
                            <>
                              <Field
                                label="Estimated start"
                                type="date"
                                value={f.estimated_start}
                                onChange={(v) =>
                                  update({ estimated_start: v || null })
                                }
                              />
                              <Field
                                label="Estimated end (optional)"
                                type="date"
                                value={f.estimated_end || ""}
                                onChange={(v) =>
                                  update({ estimated_end: v || null })
                                }
                              />
                            </>
                          )}
                          <Field
                            label="Scenario description"
                            type="textarea"
                            value={f.description}
                            onChange={(v) => update({ description: v })}
                          />
                          <Field
                            label="Rationale"
                            type="textarea"
                            required
                            value={f.rationale}
                            onChange={(v) => update({ rationale: v })}
                          />
                          <Field
                            label="Assumptions & uncertainty"
                            type="textarea"
                            value={f.assumptions}
                            onChange={(v) => update({ assumptions: v })}
                          />
                          <label>
                            Confidence
                            <select
                              value={f.confidence}
                              onChange={(e) =>
                                update({
                                  confidence: e.target
                                    .value as typeof f.confidence,
                                })
                              }
                            >
                              {["low", "medium", "high"].map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </label>
                        </fieldset>
                      );
                    })
                  )}
                  <label>
                    Category
                    <select
                      aria-label="Category"
                      value={event.category_id}
                      onChange={(e) =>
                        changeEvent({ category_id: e.target.value })
                      }
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Technology type
                    <select
                      aria-label="Technology type"
                      value={event.technology_type}
                      onChange={(e) =>
                        changeEvent({
                          technology_type: e.target
                            .value as Event["technology_type"],
                        })
                      }
                    >
                      {["AI", "AI+robotics", "other"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Summary"
                    type="textarea"
                    value={event.summary}
                    required
                    onChange={(v) => changeEvent({ summary: v })}
                  />
                  <Field
                    label="Impact & significance (interpretation)"
                    type="textarea"
                    value={event.impact}
                    onChange={(v) => changeEvent({ impact: v })}
                  />
                  <label>
                    Visibility
                    <select
                      aria-label="Visibility"
                      value={event.status}
                      onChange={(e) =>
                        changeEvent({
                          status: e.target.value as Event["status"],
                        })
                      }
                    >
                      {["draft", "published", "archived"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>Sources (required for verified history)</legend>
                    {event.sources.map((s, i) => (
                      <div className="source-editor" key={i}>
                        {(
                          ["publisher", "title", "url", "accessed_at"] as const
                        ).map((k) => (
                          <Field
                            key={k}
                            label={k.replace("_", " ")}
                            type={
                              k === "accessed_at"
                                ? "date"
                                : k === "url"
                                  ? "url"
                                  : "text"
                            }
                            value={s[k]}
                            onChange={(v) =>
                              changeEvent({
                                sources: event.sources.map((source, j) =>
                                  j === i ? { ...source, [k]: v } : source,
                                ),
                              })
                            }
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            changeEvent({
                              sources: event.sources.filter((_, j) => i !== j),
                            })
                          }
                        >
                          Remove source
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        changeEvent({
                          sources: [
                            ...event.sources,
                            {
                              publisher: "",
                              title: "",
                              url: "",
                              accessed_at: new Date()
                                .toISOString()
                                .slice(0, 10),
                            },
                          ],
                        })
                      }
                    >
                      Add source
                    </button>
                  </fieldset>
                  <fieldset>
                    <legend>Related events</legend>
                    {event.links.map((l, i) => (
                      <div key={i}>
                        <label>
                          Event
                          <select
                            value={l.target_event_id}
                            onChange={(e) =>
                              changeEvent({
                                links: event.links.map((x, j) =>
                                  j === i
                                    ? { ...x, target_event_id: e.target.value }
                                    : x,
                                ),
                              })
                            }
                          >
                            {events
                              .filter((e) => e.id !== event.id)
                              .map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.title}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Relationship
                          <select
                            value={l.relationship}
                            onChange={(e) =>
                              changeEvent({
                                links: event.links.map((x, j) =>
                                  j === i
                                    ? {
                                        ...x,
                                        relationship: e.target
                                          .value as typeof l.relationship,
                                      }
                                    : x,
                                ),
                              })
                            }
                          >
                            <option>enables</option>
                            <option>influenced-by</option>
                          </select>
                        </label>
                        <Field
                          label="Explanation"
                          value={l.explanation}
                          onChange={(v) =>
                            changeEvent({
                              links: event.links.map((x, j) =>
                                j === i ? { ...x, explanation: v } : x,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            changeEvent({
                              links: event.links.filter((_, j) => j !== i),
                            })
                          }
                        >
                          Remove relationship
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        changeEvent({
                          links: [
                            ...event.links,
                            {
                              target_event_id:
                                events.find((e) => e.id !== event.id)?.id || "",
                              relationship: "enables",
                              explanation: "",
                            },
                          ],
                        })
                      }
                    >
                      Add relationship
                    </button>
                  </fieldset>
                  <div className="form-actions">
                    <button type="button" onClick={() => setPreview((p) => !p)}>
                      Preview
                    </button>
                    <button disabled={busy} type="submit">
                      Save event
                    </button>
                  </div>
                  {preview && (
                    <article className="preview">
                      <h3>{event.title}</h3>
                      <p>{event.summary}</p>
                      <small>
                        {event.kind} ·{" "}
                        {event.historical_date_start ||
                          event.forecasts?.[scenario].estimated_start ||
                          "Not forecast"}
                      </small>
                    </article>
                  )}
                </form>
              )}
              {point && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <h3>{point.id ? "Edit" : "Add"} curve point</h3>
                  <label>
                    Series
                    <select
                      aria-label="Series"
                      disabled={Boolean(point.id)}
                      value={point.scenario_id || "shared"}
                      onChange={(e) =>
                        changePoint({
                          scenario_id:
                            e.target.value === "shared"
                              ? null
                              : (e.target.value as Scenario),
                          point_date:
                            e.target.value === "shared"
                              ? "2001-01-01"
                              : "2030-01-01",
                        })
                      }
                    >
                      <option value="shared">Shared history</option>
                      <option value="baseline">Baseline</option>
                      <option value="accelerated">Accelerated</option>
                    </select>
                  </label>
                  <Field
                    label="Point date"
                    type="date"
                    value={point.point_date}
                    onChange={(v) => changePoint({ point_date: v })}
                  />
                  <Field
                    label="Technology index (0–100)"
                    type="number"
                    value={point.technology_index}
                    onChange={(v) =>
                      changePoint({ technology_index: Number(v) })
                    }
                  />
                  <Field
                    label="Human effort index (0–100)"
                    type="number"
                    value={point.human_effort_index}
                    onChange={(v) =>
                      changePoint({ human_effort_index: Number(v) })
                    }
                  />
                  <Field
                    label="Rationale"
                    type="textarea"
                    required
                    value={point.rationale}
                    onChange={(v) => changePoint({ rationale: v })}
                  />
                  <PointPreview point={point} points={points} />
                  <p>
                    Immediate preview above. Saving refreshes the main graph.
                    Shared history is identical in both scenarios.
                  </p>
                  <button disabled={busy} type="submit">
                    Save curve point
                  </button>
                </form>
              )}
            </section>
          </div>
        )}
        {tab === "data" && (
          <section className="data-tools">
            <h3>Export / import</h3>
            <p>
              Import is an atomic replacement. Duplicate IDs are reported in
              preview; commit explicitly replaces current records. Export first.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const data = await api("/export");
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "the-shift-export.json";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }, false)
              }
            >
              Export JSON
            </button>
            <label>
              Import JSON file
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setImportText(await f.text());
                    setImportPreview(null);
                  }
                }}
              />
            </label>
            <Field
              label="Import JSON"
              type="textarea"
              value={importText}
              onChange={(v) => {
                setImportText(v);
                setImportPreview(null);
              }}
            />
            <button
              disabled={busy}
              onClick={() =>
                void run(
                  async () =>
                    setImportPreview(
                      await api(
                        "/import/preview",
                        "POST",
                        JSON.parse(importText),
                      ),
                    ),
                  false,
                )
              }
            >
              Dry-run preview
            </button>
            {importPreview !== null && (
              <>
                <pre>{JSON.stringify(importPreview, null, 2)}</pre>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Replace ALL current data with this import?"))
                      void run(() =>
                        api("/import/commit", "POST", {
                          confirm: "REPLACE",
                          data: JSON.parse(importText),
                        }),
                      );
                  }}
                >
                  Commit replacement
                </button>
              </>
            )}
            <h3>SQLite backups</h3>
            <p>
              Uses the SQLite backup API. Restore checks integrity and validates
              data before replacing records.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const b = await api<{ name: string }>(
                    "/admin/backup",
                    "POST",
                  );
                  setBackup(b.name);
                })
              }
            >
              Create backup
            </button>
            <label>
              Available backups
              <select
                value={backup}
                onChange={(e) => setBackup(e.target.value)}
              >
                <option value="">Choose backup</option>
                {backups.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <button
              disabled={busy || !backup}
              onClick={() => {
                if (
                  confirm(
                    "Restore this backup and replace ALL current timeline data?",
                  )
                )
                  void run(() =>
                    api("/admin/restore", "POST", {
                      name: backup,
                      confirm: "RESTORE",
                    }),
                  );
              }}
            >
              Restore backup
            </button>
            <h3>Managed categories</h3>
            <Field
              label="New category name"
              value={newCategory}
              onChange={setNewCategory}
            />
            <button
              disabled={busy || !newCategory.trim()}
              onClick={() =>
                void run(() =>
                  api("/categories", "POST", {
                    name: newCategory,
                    parent_id: null,
                  }),
                )
              }
            >
              Add category
            </button>
            <p>{categories.map((c) => c.name).join(" · ")}</p>
          </section>
        )}
      </section>
    </div>
  );
}
function PointPreview({ point, points }: { point: Point; points: Point[] }) {
  const list = [
    ...points.filter(
      (p) =>
        p.id !== point.id &&
        (p.scenario_id === null || p.scenario_id === point.scenario_id),
    ),
    point,
  ].sort((a, b) => a.point_date.localeCompare(b.point_date));
  const start = Date.parse(MIN_DATE),
    end = Date.parse(MAX_DATE);
  const path = (k: "technology_index" | "human_effort_index") =>
    list
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${10 + ((Date.parse(p.point_date) - start) / (end - start)) * 380},${110 - p[k]}`,
      )
      .join(" ");
  return (
    <svg
      className="point-preview"
      viewBox="0 0 400 120"
      aria-label="Unsaved curve preview"
    >
      <path d={path("technology_index")} className="curve technology" />
      <path d={path("human_effort_index")} className="curve human" />
    </svg>
  );
}
