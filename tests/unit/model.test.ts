import { describe, it, expect } from "vitest";
import {
  crossover,
  indices,
  dateSchema,
  eventSchema,
  Point,
  time,
} from "../../packages/shared/src/model";
const p = (d: string, t: number, h: number): Point => ({
  id: d,
  point_date: d,
  scenario_id: null,
  technology_index: t,
  human_effort_index: h,
  rationale: "test",
});
describe("conceptual indices", () => {
  it("calculates intersections instead of hardcoding dates", () => {
    const ps = [p("1900-01-01", 0, 100), p("2000-01-01", 100, 0)];
    expect(crossover(ps)).toBe((time("1900-01-01") + time("2000-01-01")) / 2);
    expect(
      crossover([p("1900-01-01", 2, 100), p("2000-01-01", 60, 90)]),
    ).toBeNull();
  });
  it("bounds linear interpolation and preserves dates", () => {
    const ps = [p("1900-01-01", 3, 98), p("2000-01-01", 25, 92)];
    expect(indices(ps, time("1800-01-01"))).toEqual([3, 98]);
    expect(indices(ps, time("2100-01-01"))).toEqual([25, 92]);
    expect(indices(ps, (time("1900-01-01") + time("2000-01-01")) / 2)).toEqual([
      14, 95,
    ]);
  });
  it("rejects impossible dates", () => {
    expect(dateSchema.safeParse("2025-02-29").success).toBe(false);
    expect(dateSchema.safeParse("2000-02-29").success).toBe(true);
  });
  it("rejects invented exact dates for year precision and unsafe sources", () => {
    const e = {
      title: "Test",
      kind: "verified_history",
      date_precision: "year",
      historical_date_start: "2000-06-30",
      category_id: "computing",
      summary: "test",
      status: "published",
      sources: [
        {
          publisher: "Test",
          title: "Test",
          url: "javascript:alert(1)",
          accessed_at: "2026-10-14",
        },
      ],
    };
    expect(eventSchema.safeParse(e).success).toBe(false);
  });
});
