import { Event, Point, Scenario, eventDate, indices, time } from "./model";
// Original anchors remain as a non-destructive interpolation scaffold. Every
// published milestone also has a point; an explicit event value overrides the
// scaffold at that date. Coincident events must agree on explicit coordinates.
export function eventCurve(e: Event, s: Scenario) {
  return e.kind === "future_forecast" ? e.forecasts?.[s].curve : e.curve;
}
export function timelinePoints(
  anchors: Point[],
  events: Event[],
  scenario: Scenario,
): Point[] {
  const map = new Map(
    anchors
      .filter((p) => p.scenario_id === null || p.scenario_id === scenario)
      .map((p) => [p.point_date, { ...p }]),
  );
  const visible = events.filter(
    (e) => e.status === "published" && !e.deleted_at && eventDate(e, scenario),
  );
  for (const e of visible) {
    const date = eventDate(e, scenario)!,
      curve = eventCurve(e, scenario);
    if (curve)
      map.set(date, {
        id: `event-${e.id}-${e.kind === "future_forecast" ? scenario : "history"}`,
        scenario_id: e.kind === "future_forecast" ? scenario : null,
        point_date: date,
        ...curve,
      });
  }
  const shape = [...map.values()];
  for (const e of visible) {
    const date = eventDate(e, scenario)!;
    if (map.has(date)) continue;
    const [technology_index, human_effort_index] = indices(shape, time(date));
    map.set(date, {
      id: `event-${e.id}-${e.kind === "future_forecast" ? scenario : "history"}`,
      scenario_id: e.kind === "future_forecast" ? scenario : null,
      point_date: date,
      technology_index,
      human_effort_index,
      rationale:
        "Event point interpolated from surrounding explicit values and anchors.",
    });
  }
  return [...map.values()].sort((a, b) =>
    a.point_date.localeCompare(b.point_date),
  );
}
export function validateEventCurves(events: Event[]) {
  for (const scenario of ["baseline", "accelerated", "exponential"] as const) {
    const values = new Map<
      string,
      { event: Event; technology_index: number; human_effort_index: number }
    >();
    for (const e of events) {
      if (e.status !== "published" || e.deleted_at) continue;
      const date = eventDate(e, scenario),
        curve = eventCurve(e, scenario);
      if (!date || !curve) continue;
      const old = values.get(date);
      if (
        old &&
        (old.technology_index !== curve.technology_index ||
          old.human_effort_index !== curve.human_effort_index)
      )
        throw new Error(
          `Same-date events share curve values: ${date} (${scenario}) conflicts with “${old.event.title}”. Use matching values or automatic interpolation.`,
        );
      values.set(date, { event: e, ...curve });
    }
  }
}
