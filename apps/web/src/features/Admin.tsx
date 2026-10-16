import { useEffect, useRef, useState } from "react";
import {
  Category,
  CUTOFF,
  Event,
  Point,
  Scenario,
  SCENARIOS,
  SCENARIO_LABELS,
  eventSchema,
  pointSchema,
} from "../../../../packages/shared/src/model";
import { api, ApiError } from "../lib/api";
import { AGE_AI_AS_OF } from "../../../../packages/shared/src/age-ai-data";
import { Field } from "../components/Field";
import { EventEditor, CurvePreview, Pencil } from "./EventEditor";
import { DataTools } from "./DataTools";
type Props = {
  scenario: Scenario;
  categories: Category[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
};
function blankEvent(category_id: string): Event {
  return {
    id: "",
    title: "",
    kind: "verified_history",
    date_precision: "year",
    historical_date_start: "2000-01-01",
    historical_date_end: null,
    category_id,
    is_military: false,
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
export function Admin({ scenario, categories, onClose, onRefresh }: Props) {
  const dialog = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<"events" | "points" | "data">("events"),
    [events, setEvents] = useState<Event[]>([]),
    [points, setPoints] = useState<Point[]>([]),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("title"),
    [event, setEvent] = useState<Event | null>(null),
    [point, setPoint] = useState<Point | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    [backups, setBackups] = useState<string[]>([]);
  const recordSeries = point?.scenario_id || scenario;
  const listedPoints = points.filter(
    (p) => p.scenario_id === null || p.scenario_id === scenario,
  );
  async function load() {
    const [e, b, ...series] = await Promise.all([
      api<{ items: Event[] }>("/events?limit=500"),
      api<string[]>("/admin/backups"),
      ...SCENARIOS.map((s) => api<Point[]>("/curve-points?scenario=" + s)),
    ]);
    setEvents(e.items);
    setBackups(b);
    setPoints([...new Map(series.flat().map((p) => [p.id, p])).values()]);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [scenario]);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => prior?.focus();
  }, []);
  const discard = () => !dirty || confirm("Discard unsaved changes?");
  const close = () => {
    if (discard()) onClose();
  };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const controls = [
          ...(dialog.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,a[href]",
          ) || []),
        ].filter((e) => e.getClientRects().length && e.tabIndex >= 0);
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", keys);
    };
  }, [dirty]);
  async function run(action: () => Promise<unknown>, refresh = true) {
    setBusy(true);
    setErrors({});
    setMessage("");
    try {
      await action();
      if (refresh) {
        await load();
        await onRefresh();
      }
      setMessage("Saved successfully.");
      return true;
    } catch (error) {
      setMessage((error as Error).message);
      if (error instanceof ApiError) setErrors(error.fieldErrors);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function switchTab(t: typeof tab) {
    if (!discard()) return;
    setTab(t);
    setEvent(null);
    setPoint(null);
    setDirty(false);
    setErrors({});
    setSearch("");
  }
  function editEvent(e: Event) {
    if (!discard()) return;
    setEvent(structuredClone(e));
    setPoint(null);
    setDirty(false);
    setErrors({});
  }
  function editPoint(p: Point) {
    if (!discard()) return;
    setPoint({ ...p });
    setEvent(null);
    setDirty(false);
    setErrors({});
  }
  const changeEvent = (patch: Partial<Event>) => {
    setEvent((e) => (e ? { ...e, ...patch } : e));
    setDirty(true);
  };
  const changePoint = (patch: Partial<Point>) => {
    setPoint((p) => (p ? { ...p, ...patch } : p));
    setDirty(true);
  };
  async function save() {
    const value = event || point;
    if (!value) return;
    const input = { ...value, id: value.id || undefined };
    const validation = (event ? eventSchema : pointSchema).safeParse(input);
    if (!validation.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of validation.error.issues) {
        const key = issue.path.join(".");
        fields[key] = [...(fields[key] || []), issue.message];
      }
      setErrors(fields);
      setMessage("Check the fields below.");
      return;
    }
    const path = event ? "/events" : "/curve-points";
    if (
      await run(() =>
        api(
          path + (value.id ? "/" + value.id : ""),
          value.id ? "PATCH" : "POST",
          input,
        ),
      )
    ) {
      setDirty(false);
      setEvent(null);
      setPoint(null);
    }
  }
  const sortedEvents = events
    .filter((e) =>
      (e.title + " " + e.status).toLowerCase().includes(search.toLowerCase()),
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
    );
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
            <p>
              Events & their curve points · local SQLite · historical cutoff{" "}
              {scenario === "age-of-ai" ? AGE_AI_AS_OF : CUTOFF}
            </p>
          </div>
          <button onClick={close} aria-label="Close management">
            ×
          </button>
        </header>
        <nav className="tabs">
          <button
            aria-pressed={tab !== "data"}
            onClick={() => switchTab("events")}
          >
            Events & curve points
          </button>
          <button
            aria-pressed={tab === "data"}
            onClick={() => switchTab("data")}
          >
            Data & backups
          </button>
        </nav>
        <div role="status" className="notice">
          {message}
        </div>
        {Object.keys(errors).length > 0 && (
          <div role="alert" className="validation">
            {Object.entries(errors).map(([key, issues]) => (
              <p key={key}>
                <strong>{key}</strong>: {issues.join(" · ")}
              </p>
            ))}
          </div>
        )}
        {tab === "data" ? (
          <DataTools
            busy={busy}
            backups={backups}
            categories={categories}
            run={run}
          />
        ) : (
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
                <button
                  className="advanced-toggle"
                  onClick={() =>
                    switchTab(tab === "events" ? "points" : "events")
                  }
                >
                  {tab === "events"
                    ? "Advanced anchors"
                    : "Back to events & curve points"}
                </button>
              </div>
              {tab === "events"
                ? sortedEvents.map((e) => (
                    <article
                      key={e.id}
                      className={e.deleted_at ? "deleted" : ""}
                    >
                      <button
                        className="record-title"
                        onClick={() => editEvent(e)}
                        title="Edit this event and its curve values"
                      >
                        {e.title} <Pencil />
                      </button>
                      <small>
                        {e.kind.replaceAll("_", " ")} ·{" "}
                        {e.deleted_at ? "deleted" : e.status} · curve point
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
                                "Soft-delete this event and remove its curve contribution? Both can be restored.",
                              )
                            )
                              void run(() => api("/events/" + e.id, "DELETE"));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                : listedPoints
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
                          {p.point_date} · {p.scenario_id || "shared history"}{" "}
                          <Pencil />
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
                                "Delete scaffold anchor? Essential boundaries are protected.",
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
            {event ? (
              <EventEditor
                event={event}
                events={events}
                anchors={points}
                categories={categories}
                scenario={scenario}
                busy={busy}
                errors={errors}
                onChange={changeEvent}
                onSave={() => void save()}
              />
            ) : point ? (
              <section className="editor">
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <h3>{point.id ? "Edit" : "Add"} scaffold anchor</h3>
                  <p>
                    Advanced interpolation support. Add or edit ordinary
                    milestones through Events & curve points.
                  </p>
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
                      {SCENARIOS.map((s) => (
                        <option key={s} value={s}>
                          {SCENARIO_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Point date"
                    type="date"
                    value={point.point_date}
                    onChange={(point_date) => changePoint({ point_date })}
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
                    onChange={(rationale) => changePoint({ rationale })}
                  />
                  <CurvePreview
                    points={[
                      ...points.filter(
                        (p) =>
                          p.id !== point.id &&
                          (p.scenario_id === null ||
                            p.scenario_id === recordSeries),
                      ),
                      point,
                    ]}
                  />
                  <button type="submit" disabled={busy}>
                    Save curve point
                  </button>
                </form>
              </section>
            ) : (
              <section className="editor">
                <p>
                  Select a title <Pencil /> to edit. Every published event
                  coexists with a point on the curve; edit its historical values
                  or each scenario’s values in the same form. Existing scaffold
                  anchors are retained under Advanced anchors.
                </p>
              </section>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
