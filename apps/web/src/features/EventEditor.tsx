import { useEffect, useRef, useState } from "react";
import {
  Category,
  Event,
  EventCurve,
  Point,
  Scenario,
  SCENARIOS,
  SCENARIO_LABELS,
  indices,
  time,
  eventDate,
  START,
  END,
} from "../../../../packages/shared/src/model";
import { timelinePoints } from "../../../../packages/shared/src/event-points";
import { Field } from "../components/Field";
export const emptyForecast = () => ({
  estimated_start: null as string | null,
  estimated_end: null as string | null,
  description: "",
  rationale: "",
  assumptions: "",
  confidence: "low" as const,
});
export function Pencil() {
  return (
    <svg
      className="pencil-icon"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" />
    </svg>
  );
}
export function CurvePreview({ points }: { points: Point[] }) {
  const list = [...points].sort((a, b) =>
    a.point_date.localeCompare(b.point_date),
  );
  const path = (key: "technology_index" | "human_effort_index") =>
    list
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${10 + ((time(p.point_date) - START) / (END - START)) * 380},${110 - p[key]}`,
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
function CurveFields({
  curve,
  automatic,
  onChange,
}: {
  curve?: EventCurve | null;
  automatic: [number, number];
  onChange: (c: EventCurve | null) => void;
}) {
  const value = curve || {
    technology_index: automatic[0],
    human_effort_index: automatic[1],
    rationale: "Event curve point values.",
  };
  return (
    <fieldset className="event-curve-fields">
      <legend>Event curve point · conceptual indices</legend>
      <p>
        {curve
          ? "Custom values: this event shapes the curve at its date."
          : "Automatic: this event sits on the interpolated curve. Editing either value makes it an explicit control point."}{" "}
        Same-date events share one coordinate.
      </p>
      <Field
        label="Technology index (0–100)"
        type="number"
        value={Number(value.technology_index.toFixed(4))}
        onChange={(v) => onChange({ ...value, technology_index: Number(v) })}
      />
      <Field
        label="Human effort index (0–100)"
        type="number"
        value={Number(value.human_effort_index.toFixed(4))}
        onChange={(v) => onChange({ ...value, human_effort_index: Number(v) })}
      />
      <Field
        label="Curve rationale"
        value={value.rationale}
        onChange={(v) => onChange({ ...value, rationale: v })}
      />
      {curve && (
        <button type="button" onClick={() => onChange(null)}>
          Use automatic curve values
        </button>
      )}
    </fieldset>
  );
}
type Props = {
  event: Event;
  events: Event[];
  anchors: Point[];
  categories: Category[];
  scenario: Scenario;
  busy: boolean;
  errors: Record<string, string[]>;
  onChange: (patch: Partial<Event>) => void;
  onSave: () => void;
};
export function EventEditor({
  event,
  events,
  anchors,
  categories,
  scenario,
  busy,
  errors,
  onChange,
  onSave,
}: Props) {
  const [section, setSection] = useState<"details" | Scenario>("details");
  const [preview, setPreview] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    setSection("details");
    setPreview(false);
  }, [event.id]);
  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (!first) return;
    const s = first.split(".")[1];
    setSection(
      first.startsWith("forecasts.") && SCENARIOS.includes(s as Scenario)
        ? (s as Scenario)
        : "details",
    );
  }, [errors]);
  const currentScenario = section === "details" ? scenario : section;
  const candidate = {
    ...event,
    id: event.id || "preview-new-event",
    status: "published" as const,
    deleted_at: null,
  };
  const others = events.filter((e) => e.id !== event.id);
  const previewPoints = timelinePoints(
    anchors,
    [...others, candidate],
    currentScenario,
  );
  const date = eventDate(event, currentScenario);
  const automatic =
    date && Number.isFinite(time(date))
      ? indices(timelinePoints(anchors, others, currentScenario), time(date))
      : ([0, 0] as [number, number]);
  const sections = [
    "details",
    ...(event.kind === "future_forecast" ? SCENARIOS : []),
  ] as ("details" | Scenario)[];
  const select = (s: typeof section) => {
    setSection(s);
    panel.current?.scrollTo({ top: 0 });
  };
  return (
    <section className="editor" ref={panel}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <h3>{event.id ? "Edit" : "Add"} event & curve point</h3>
        <nav
          className="event-editor-tabs"
          role="tablist"
          aria-label="Event sections"
        >
          {sections.map((s, i) => (
            <button
              type="button"
              role="tab"
              aria-selected={section === s}
              aria-controls={`event-panel-${s}`}
              id={`event-tab-${s}`}
              tabIndex={section === s ? 0 : -1}
              key={s}
              onClick={() => select(s)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const next =
                    sections[
                      (i + (e.key === "ArrowRight" ? 1 : sections.length - 1)) %
                        sections.length
                    ];
                  select(next);
                  document.getElementById(`event-tab-${next}`)?.focus();
                }
              }}
            >
              {s === "details" ? "Details" : SCENARIO_LABELS[s]}
            </button>
          ))}
        </nav>
        <div
          role="tabpanel"
          id={`event-panel-${section}`}
          aria-labelledby={`event-tab-${section}`}
        >
          {section === "details" ? (
            <>
              <Field
                label="Title"
                value={event.title}
                required
                onChange={(title) => onChange({ title })}
              />
              <label>
                Kind
                <select
                  aria-label="Kind"
                  value={event.kind}
                  onChange={(e) => {
                    const kind = e.target.value as Event["kind"];
                    onChange({
                      kind,
                      ...(kind === "future_forecast"
                        ? {
                            historical_date_start: null,
                            historical_date_end: null,
                            curve: null,
                            forecasts: event.forecasts || {
                              baseline: emptyForecast(),
                              accelerated: emptyForecast(),
                              exponential: emptyForecast(),
                            },
                          }
                        : {
                            historical_date_start:
                              event.historical_date_start || "2000-01-01",
                            forecasts: null,
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
                    onChange({
                      date_precision: e.target.value as Event["date_precision"],
                    })
                  }
                >
                  {["day", "month", "year", "range"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {event.kind !== "future_forecast" && (
                <>
                  <Field
                    label="Historical date (first day for month/year anchors)"
                    type="date"
                    value={event.historical_date_start || ""}
                    onChange={(v) =>
                      onChange({ historical_date_start: v || null })
                    }
                  />
                  {event.date_precision === "range" && (
                    <Field
                      label="Historical range end"
                      type="date"
                      value={event.historical_date_end || ""}
                      onChange={(v) =>
                        onChange({ historical_date_end: v || null })
                      }
                    />
                  )}
                  <CurveFields
                    curve={event.curve}
                    automatic={automatic}
                    onChange={(curve) => onChange({ curve })}
                  />
                </>
              )}
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={event.is_military}
                  onChange={(e) => onChange({ is_military: e.target.checked })}
                />
                Military / defence-related event
              </label>
              <label>
                Category
                <select
                  aria-label="Category"
                  value={event.category_id}
                  onChange={(e) => onChange({ category_id: e.target.value })}
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
                    onChange({
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
                required
                value={event.summary}
                onChange={(summary) => onChange({ summary })}
              />
              <Field
                label="Impact & significance (interpretation)"
                type="textarea"
                value={event.impact}
                onChange={(impact) => onChange({ impact })}
              />
              <label>
                Visibility
                <select
                  aria-label="Visibility"
                  value={event.status}
                  onChange={(e) =>
                    onChange({ status: e.target.value as Event["status"] })
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
                          onChange({
                            sources: event.sources.map((x, j) =>
                              i === j ? { ...x, [k]: v } : x,
                            ),
                          })
                        }
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
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
                    onChange({
                      sources: [
                        ...event.sources,
                        {
                          publisher: "",
                          title: "",
                          url: "",
                          accessed_at: new Date().toISOString().slice(0, 10),
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
                          onChange({
                            links: event.links.map((x, j) =>
                              i === j
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
                          onChange({
                            links: event.links.map((x, j) =>
                              i === j
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
                        onChange({
                          links: event.links.map((x, j) =>
                            i === j ? { ...x, explanation: v } : x,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          links: event.links.filter((_, j) => i !== j),
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
                    onChange({
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
            </>
          ) : (
            <ScenarioFields
              event={event}
              scenario={section}
              automatic={automatic}
              onChange={onChange}
            />
          )}
        </div>
        <div className="form-actions">
          <button type="button" onClick={() => setPreview((v) => !v)}>
            Preview
          </button>
          <button type="submit" disabled={busy}>
            Save event
          </button>
        </div>
        {preview && (
          <article className="preview">
            <h3>{event.title}</h3>
            <p>{event.summary}</p>
            <CurvePreview points={previewPoints} />
            <p>
              Preview as a published event. Saving updates the milestone and its
              curve values together.
            </p>
          </article>
        )}
      </form>
    </section>
  );
}
function ScenarioFields({
  event,
  scenario,
  automatic,
  onChange,
}: {
  event: Event;
  scenario: Scenario;
  automatic: [number, number];
  onChange: (patch: Partial<Event>) => void;
}) {
  const f = event.forecasts![scenario];
  const update = (patch: Partial<typeof f>) =>
    onChange({
      forecasts: { ...event.forecasts!, [scenario]: { ...f, ...patch } },
    });
  return (
    <fieldset>
      <legend>{scenario.toUpperCase()} · illustrative assumption</legend>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={f.estimated_start === null}
          onChange={(e) =>
            update({
              estimated_start: e.target.checked ? null : "2030-01-01",
              estimated_end: null,
            })
          }
        />
        Not forecast
      </label>
      {f.estimated_start && (
        <>
          <Field
            label="Estimated start"
            type="date"
            value={f.estimated_start}
            onChange={(v) => update({ estimated_start: v || null })}
          />
          <Field
            label="Estimated end (optional)"
            type="date"
            value={f.estimated_end || ""}
            onChange={(v) => update({ estimated_end: v || null })}
          />
          <CurveFields
            curve={f.curve}
            automatic={automatic}
            onChange={(curve) => update({ curve })}
          />
        </>
      )}
      <Field
        label="Scenario description"
        type="textarea"
        value={f.description}
        onChange={(description) => update({ description })}
      />
      <Field
        label="Rationale"
        type="textarea"
        required
        value={f.rationale}
        onChange={(rationale) => update({ rationale })}
      />
      <Field
        label="Assumptions & uncertainty"
        type="textarea"
        value={f.assumptions}
        onChange={(assumptions) => update({ assumptions })}
      />
      <label>
        Confidence
        <select
          value={f.confidence}
          onChange={(e) =>
            update({ confidence: e.target.value as typeof f.confidence })
          }
        >
          {["low", "medium", "high"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
