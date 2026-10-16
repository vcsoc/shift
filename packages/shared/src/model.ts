import { z } from "zod";
import { AGE_AI_AS_OF } from "./age-ai-data";
export const CUTOFF = "2026-10-13";
export const MIN_DATE = "1900-01-01";
export const MAX_DATE = "2100-12-31";
export const SCENARIOS = [
  "baseline",
  "accelerated",
  "exponential",
  "age-of-ai",
] as const;
export const SCENARIO_LABELS = {
  baseline: "Baseline",
  accelerated: "Accelerated",
  exponential: "Exponential",
  "age-of-ai": "Age of AI",
};
export const scenarioSchema = z.enum(SCENARIOS);
export type Scenario = z.infer<typeof scenarioSchema>;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  )
  .refine(
    (v) => v >= MIN_DATE && v <= MAX_DATE,
    "Date must be within 1900–2100",
  );
const sourceSchema = z.object({
  publisher: z.string().min(1),
  title: z.string().min(1),
  url: z
    .url()
    .refine((v) => /^https?:\/\//.test(v), "Only HTTP(S) URLs allowed"),
  accessed_at: dateSchema,
});
export const eventCurveSchema = z.object({
  technology_index: z.number().min(0).max(100),
  human_effort_index: z.number().min(0).max(100),
  rationale: z.string().min(1).max(3000),
});
export type EventCurve = z.infer<typeof eventCurveSchema>;
export const forecastSchema = z
  .object({
    estimated_start: dateSchema.nullable(),
    estimated_end: dateSchema.nullable().default(null),
    description: z.string().max(3000),
    rationale: z.string().min(1).max(3000),
    assumptions: z.string().max(3000),
    confidence: z.enum(["low", "medium", "high"]),
    curve: eventCurveSchema.nullish(),
  })
  .superRefine((v, c) => {
    if (v.estimated_start && v.estimated_start <= CUTOFF)
      c.addIssue({
        code: "custom",
        path: ["estimated_start"],
        message: "Forecast must follow historical cutoff",
      });
    if (
      v.estimated_end &&
      (!v.estimated_start || v.estimated_end < v.estimated_start)
    )
      c.addIssue({
        code: "custom",
        path: ["estimated_end"],
        message: "Range end must follow start",
      });
  });
export const AGE_AI_NOT_FORECAST = {
  estimated_start: null,
  estimated_end: null,
  description:
    "Not forecast: capability trends do not establish sector adoption or an end to human responsibility.",
  rationale: "No event date inferred from the Age of AI capability fit.",
  assumptions:
    "Human accountability, governance, auditing and escalation remain required.",
  confidence: "low" as const,
};
export const eventSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(150),
    kind: z.enum([
      "verified_history",
      "approximate_history",
      "observed_current",
      "future_forecast",
    ]),
    date_precision: z.enum(["day", "month", "year", "range"]),
    historical_date_start: dateSchema.nullable(),
    historical_date_end: dateSchema.nullable().default(null),
    category_id: z.string().min(1),
    is_military: z.boolean().default(false),
    curve: eventCurveSchema.nullish(),
    summary: z.string().trim().min(1).max(1000),
    impact: z.string().max(3000).default(""),
    technology_type: z.enum(["AI", "AI+robotics", "other"]).default("other"),
    status: z.enum(["draft", "published", "archived"]),
    sources: z.array(sourceSchema),
    forecasts: z
      .object({
        baseline: forecastSchema,
        accelerated: forecastSchema,
        "age-of-ai": forecastSchema.default(AGE_AI_NOT_FORECAST),
        exponential: forecastSchema.default({
          estimated_start: null,
          estimated_end: null,
          description: "Not forecast in this dataset.",
          rationale: "No estimate supplied for the Exponential scenario.",
          assumptions: "No extrapolation assumed.",
          confidence: "low",
        }),
      })
      .nullish(),
    links: z
      .array(
        z.object({
          target_event_id: z.string(),
          relationship: z.enum(["enables", "influenced-by"]),
          explanation: z.string(),
        }),
      )
      .default([]),
  })
  .superRefine((v, c) => {
    const ageStart = v.forecasts?.["age-of-ai"].estimated_start;
    if (ageStart && ageStart <= AGE_AI_AS_OF)
      c.addIssue({
        code: "custom",
        path: ["forecasts", "age-of-ai", "estimated_start"],
        message: "Age of AI forecast must follow its as-of date",
      });
    if (v.kind === "future_forecast") {
      if (v.curve)
        c.addIssue({
          code: "custom",
          path: ["curve"],
          message: "Forecast curve values belong in the scenario tabs",
        });
      if (v.historical_date_start)
        c.addIssue({
          code: "custom",
          path: ["historical_date_start"],
          message: "Forecasts cannot have historical dates",
        });
      if (!v.forecasts)
        c.addIssue({
          code: "custom",
          path: ["forecasts"],
          message: "Scenario estimates required (or not forecast)",
        });
    } else {
      if (!v.historical_date_start || v.historical_date_start > CUTOFF)
        c.addIssue({
          code: "custom",
          path: ["historical_date_start"],
          message: "History requires a date at or before cutoff",
        });
      if (v.forecasts)
        c.addIssue({
          code: "custom",
          path: ["forecasts"],
          message: "History cannot be scenario-specific",
        });
      if (
        v.historical_date_end &&
        (!v.historical_date_start ||
          v.historical_date_end < v.historical_date_start ||
          v.historical_date_end > CUTOFF)
      )
        c.addIssue({
          code: "custom",
          path: ["historical_date_end"],
          message: "Invalid historical range",
        });
      if (v.date_precision === "range" && !v.historical_date_end)
        c.addIssue({
          code: "custom",
          path: ["historical_date_end"],
          message: "Range requires an end date",
        });
      if (
        v.historical_date_start &&
        ((v.date_precision === "year" &&
          !v.historical_date_start.endsWith("-01-01")) ||
          (v.date_precision === "month" &&
            !v.historical_date_start.endsWith("-01")))
      )
        c.addIssue({
          code: "custom",
          path: ["historical_date_start"],
          message: "Use first day as internal anchor for year/month precision",
        });
    }
    if (
      (v.kind === "verified_history" || v.kind === "observed_current") &&
      !v.sources.length
    )
      c.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Verified observations require at least one source",
      });
  });
export type Event = z.infer<typeof eventSchema> & {
  id: string;
  deleted_at?: string | null;
};
export const pointSchema = z
  .object({
    id: z.string().optional(),
    scenario_id: scenarioSchema.nullable(),
    point_date: dateSchema,
    technology_index: z.number().min(0).max(100),
    human_effort_index: z.number().min(0).max(100),
    rationale: z.string().min(1).max(3000),
  })
  .superRefine((v, c) => {
    if (
      v.scenario_id === "age-of-ai"
        ? v.point_date < AGE_AI_AS_OF
        : (v.scenario_id === null && v.point_date > CUTOFF) ||
          (v.scenario_id !== null && v.point_date <= CUTOFF)
    )
      c.addIssue({
        code: "custom",
        path: ["point_date"],
        message:
          "Shared points must be historical; scenario points must follow cutoff (Age of AI starts at its as-of date)",
      });
  });
export type Point = z.infer<typeof pointSchema> & { id: string };
export type Category = { id: string; name: string; parent_id: string | null };
export type Timeline = {
  events: Event[];
  points: Point[];
  categories: Category[];
  scenario: Scenario;
  cutoff: string;
};
export const time = (date: string) => Date.parse(date + "T00:00:00Z");
export const START = time(MIN_DATE),
  END = time(MAX_DATE);
export function eventDate(e: Event, s: Scenario) {
  return e.kind === "future_forecast"
    ? (e.forecasts?.[s]?.estimated_start ?? null)
    : e.historical_date_start;
}
export function indices(points: Point[], t: number): [number, number] {
  const sorted = [...points].sort((a, b) =>
    a.point_date.localeCompare(b.point_date),
  );
  if (!sorted.length) return [0, 0];
  let a = sorted[0],
    b = a;
  for (const p of sorted) {
    b = p;
    if (time(p.point_date) >= t) break;
    a = p;
  }
  const f =
    a === b
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (t - time(a.point_date)) /
              (time(b.point_date) - time(a.point_date)),
          ),
        );
  return [
    a.technology_index + (b.technology_index - a.technology_index) * f,
    a.human_effort_index + (b.human_effort_index - a.human_effort_index) * f,
  ];
}
export function crossover(points: Point[]): number | null {
  const p = [...points].sort((a, b) =>
    a.point_date.localeCompare(b.point_date),
  );
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      da = a.technology_index - a.human_effort_index,
      db = b.technology_index - b.human_effort_index;
    if (da === 0) return time(a.point_date);
    if (da * db <= 0 && da !== db)
      return (
        time(a.point_date) +
        (time(b.point_date) - time(a.point_date)) * (-da / (db - da))
      );
  }
  return null;
}
export function dateLabel(e: Event, s: Scenario) {
  const d = eventDate(e, s);
  if (!d) return "Not forecast";
  const end =
    e.kind === "future_forecast"
      ? e.forecasts?.[s].estimated_end
      : e.historical_date_end;
  if (
    e.kind === "future_forecast" &&
    e.date_precision === "range" &&
    d.endsWith("-01-01") &&
    end &&
    (end.endsWith("-01-01") || end.endsWith("-12-31"))
  )
    return `${d.slice(0, 4)}–${end.slice(0, 4)} (illustrative window)`;
  if (e.date_precision === "year") return d.slice(0, 4);
  if (e.date_precision === "month")
    return new Date(time(d)).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  return (
    new Date(time(d)).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }) + (end ? " – " + end : "")
  );
}
