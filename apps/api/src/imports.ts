import { z } from "zod";
import { CUTOFF, pointSchema } from "../../../packages/shared/src/model";
import { exponentialPoints } from "../../../packages/shared/src/exponential";
import {
  AGE_AI_SCENARIO,
  ageAIPoints,
} from "../../../packages/shared/src/age-ai";
// Add missing scenarios without changing old anchors or inventing event dates.
// Shared eventSchema defaults newly introduced forecasts to "not forecast".
export function upgradeImport(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const version = (input as { schema_version?: unknown }).schema_version;
  if (![1, 2, 3].includes(version as number)) return input;
  let legacy = z
    .object({
      schema_version: z.number(),
      scenarios: z.array(z.object({ id: z.string() }).passthrough()),
      curve_points: z.array(pointSchema),
    })
    .passthrough()
    .parse(input);
  const expected =
    version === 1
      ? ["baseline", "accelerated"]
      : ["baseline", "accelerated", "exponential"];
  if (
    legacy.scenarios.length !== expected.length ||
    new Set(legacy.scenarios.map((s) => s.id)).size !== expected.length ||
    legacy.scenarios.some((s) => !expected.includes(s.id))
  )
    throw new Error("Invalid legacy scenarios");
  if (version === 1) {
    const anchor = legacy.curve_points.find(
      (p) => p.scenario_id === null && p.point_date === CUTOFF,
    );
    legacy = {
      ...legacy,
      scenarios: [
        ...legacy.scenarios,
        {
          id: "exponential",
          name: "Exponential",
          description:
            "Speculative continuation of recent task-horizon growth.",
          assumptions:
            "Not forecast for imported events unless explicitly edited.",
          is_default: 0,
        },
      ],
      curve_points: [
        ...legacy.curve_points,
        ...exponentialPoints(
          anchor?.technology_index,
          anchor?.human_effort_index,
        ),
      ],
    };
  }
  const origin = legacy.curve_points.find(
    (p) => p.scenario_id === null && p.point_date === CUTOFF,
  );
  return {
    ...legacy,
    schema_version: 4,
    scenarios: [...legacy.scenarios, AGE_AI_SCENARIO],
    curve_points: [
      ...legacy.curve_points,
      ...ageAIPoints(origin?.technology_index, origin?.human_effort_index),
    ],
  };
}
