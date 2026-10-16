import {
  eventSchema,
  pointSchema,
  scenarioSchema,
  Timeline,
} from "../../../../packages/shared/src/model";
import { z } from "zod";
export class ApiError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      "X-Shift-Admin": "local",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new ApiError(
      "Server returned malformed JSON. Retry or restart the local server.",
    );
  }
  if (!response.ok)
    throw new ApiError(value.message || "Request failed", value.fieldErrors);
  return value as T;
}
const timelineSchema = z.object({
  events: z.array(eventSchema.safeExtend({ id: z.string() })),
  points: z.array(pointSchema.safeExtend({ id: z.string() })).min(2),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      parent_id: z.string().nullable(),
    }),
  ),
  scenario: scenarioSchema,
  cutoff: z.string(),
});
export async function fetchTimeline(
  s: string,
  military = false,
): Promise<Timeline> {
  const data = await api(
    "/timeline?scenario=" + s + "&military=" + (military ? "1" : "0"),
  );
  const parsed = timelineSchema.safeParse(data);
  if (!parsed.success)
    throw new ApiError(
      "Timeline data is empty or malformed. Retry or restore a validated backup.",
    );
  return parsed.data;
}
