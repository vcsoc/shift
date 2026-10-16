import { z } from "zod";
import { CUTOFF, pointSchema } from "../../../packages/shared/src/model";
import { exponentialPoints } from "../../../packages/shared/src/exponential";
// Version 1 exports had two scenarios. Preserve their data and mark the third
// scenario's event estimates as not forecast (handled by the shared schema).
export function upgradeImport(input: unknown): unknown {
  if (
    input &&
    typeof input === "object" &&
    (input as { schema_version?: unknown }).schema_version === 2
  )
    return { ...input, schema_version: 3 };
  if (
    !input ||
    typeof input !== "object" ||
    (input as { schema_version?: unknown }).schema_version !== 1
  )
    return input;
  const legacy = z
    .object({
      schema_version: z.literal(1),
      scenarios: z
        .array(
          z.object({ id: z.enum(["baseline", "accelerated"]) }).passthrough(),
        )
        .length(2),
      curve_points: z.array(pointSchema),
    })
    .passthrough()
    .parse(input);
  if (new Set(legacy.scenarios.map((s) => s.id)).size !== 2)
    throw new Error("Duplicate legacy scenarios");
  const anchor = legacy.curve_points.find(
    (p) => p.scenario_id === null && p.point_date === CUTOFF,
  );
  return {
    ...legacy,
    schema_version: 3,
    scenarios: [
      ...legacy.scenarios,
      {
        id: "exponential",
        name: "Exponential",
        description: "Speculative continuation of recent task-horizon growth.",
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
