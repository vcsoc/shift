import { Event, MAX_DATE, Point, time } from "./model";
import {
  AGE_AI_START,
  AGE_AI_AS_OF,
  AGE_AI_OBSERVATIONS,
  AGE_AI_SOURCE,
} from "./age-ai-data";
export { AGE_AI_START, AGE_AI_AS_OF, AGE_AI_OBSERVATIONS, AGE_AI_SOURCE };
const DAY = 86400000;
// Fit log(minutes) against elapsed days, using only this recent frontier sample.
// No pre-2023 anchors or hard-coded doubling rate enter the regression.
export function fitAgeAI(
  observations: ReadonlyArray<{
    date: string;
    minutes: number;
  }> = AGE_AI_OBSERVATIONS,
) {
  const sample = observations.filter(
    (o) =>
      o.date >= AGE_AI_START &&
      o.date <= AGE_AI_AS_OF &&
      Number.isFinite(time(o.date)) &&
      Number.isFinite(o.minutes) &&
      o.minutes > 0,
  );
  if (sample.length < 2)
    throw new Error("Age of AI requires at least two recent observations");
  const xs = sample.map((o) => (time(o.date) - time(AGE_AI_START)) / DAY);
  const ys = sample.map((o) => Math.log(o.minutes));
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  const variance = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  if (!variance)
    throw new Error("Age of AI requires distinct observation dates");
  const slope =
    xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / variance;
  if (slope <= 0) throw new Error("Age of AI sample does not support growth");
  return {
    slope,
    intercept: meanY - slope * meanX,
    doublingDays: Math.LN2 / slope,
    count: sample.length,
  };
}
export const AGE_AI_FIT = fitAgeAI();
export const AGE_AI_ASSUMPTIONS =
  "Growth rate fitted only to 2023–2026 METR software-task results, continued conditionally from today's shared index levels. 50% benchmark success is not production reliability. The 0.45 adoption attenuation, 0.16/0.12 index mappings and 25-point human floor are subjective, not observed declines in work or responsibility. Accountability, governance, auditing and escalation remain human responsibilities; adoption may stall. No sector or human-role cessation dates are inferred.";
export const AGE_AI_SCENARIO = {
  id: "age-of-ai",
  name: "Age of AI",
  description: `Recent AI capability trend fitted from ${AGE_AI_START} through ${AGE_AI_AS_OF}, with an explicitly hypothetical human-effort proxy.`,
  assumptions: AGE_AI_ASSUMPTIONS,
  is_default: 0,
};
export function ageAIIndices(
  date: string,
  technology = 43,
  human = 89,
): [number, number] {
  const days = Math.max(0, (time(date) - time(AGE_AI_AS_OF)) / DAY);
  // H(date)/H(today) from the recent log-linear fit. Earlier historical points
  // set the visible context, never the fitted slope. Adoption is an assumption.
  const adoption = Math.expm1(AGE_AI_FIT.slope * days * 0.45);
  const floor = Math.min(25, human);
  return [
    100 - (100 - technology) / (1 + 0.16 * adoption),
    floor + (human - floor) / (1 + 0.12 * adoption),
  ];
}
export function ageAIPoints(technology = 43, human = 89): Point[] {
  const dates = new Set([AGE_AI_AS_OF, MAX_DATE]);
  // Monthly near-term sampling, annual long run. Full shared history is retained.
  for (let year = 2026; year <= 2040; year++)
    for (let month = 1; month <= 12; month++) {
      const date = `${year}-${String(month).padStart(2, "0")}-01`;
      if (date > AGE_AI_AS_OF) dates.add(date);
    }
  for (let year = 2041; year <= 2100; year++) dates.add(`${year}-01-01`);
  return [...dates].sort().map((date) => {
    const [technology_index, human_effort_index] = ageAIIndices(
      date,
      technology,
      human,
    );
    return {
      id: `point-age-of-ai-${date}`,
      scenario_id: "age-of-ai",
      point_date: date,
      technology_index: Number(technology_index.toFixed(6)),
      human_effort_index: Number(human_effort_index.toFixed(6)),
      rationale: `${date === AGE_AI_AS_OF ? "Forecast origin at the latest shared historical index levels" : "Conditional extrapolation"}. METR-Horizon-v1.1, ${AGE_AI_FIT.count} frontier observations since 2023; fitted doubling ${AGE_AI_FIT.doublingDays.toFixed(1)} days. ${AGE_AI_ASSUMPTIONS}`,
    };
  });
}
export function ageAIEvent(e: Event) {
  if (e.kind === "future_forecast")
    return Boolean(e.forecasts?.["age-of-ai"]?.estimated_start);
  return true; // Historical context is visible but is never an input to the fit.
}
