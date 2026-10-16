import { expect, it } from "vitest";
import {
  AGE_AI_AS_OF,
  AGE_AI_START,
  AGE_AI_FIT,
  AGE_AI_OBSERVATIONS,
  ageAIIndices,
  ageAIPoints,
  fitAgeAI,
} from "../../packages/shared/src/age-ai";
import { MAX_DATE, time } from "../../packages/shared/src/model";
it("fits the growth rate from recent observations rather than assuming a doubling period", () => {
  const sample = [
    { date: "2023-01-01", minutes: 2 },
    { date: "2023-04-11", minutes: 4 },
    { date: "2023-07-20", minutes: 8 },
  ];
  expect(fitAgeAI(sample).doublingDays).toBeCloseTo(100, 8);
  expect(fitAgeAI(sample).intercept).toBeCloseTo(Math.log(2), 8);
  expect(
    fitAgeAI([
      ...sample,
      { date: "2022-12-31", minutes: 1e9 },
      { date: "2027-01-01", minutes: 1e-9 },
    ]),
  ).toEqual(fitAgeAI(sample));
  expect(AGE_AI_FIT.count).toBe(15);
  expect(AGE_AI_FIT.doublingDays).toBeCloseTo(124.76559, 4);
  expect(
    AGE_AI_OBSERVATIONS.every(
      (o) => o.date >= AGE_AI_START && o.date <= AGE_AI_AS_OF,
    ),
  ).toBe(true);
});
it("rejects insufficient, undated or non-growing samples", () => {
  expect(() => fitAgeAI([])).toThrow();
  expect(() =>
    fitAgeAI([
      { date: "2023-01-01", minutes: 1 },
      { date: "2023-01-01", minutes: 2 },
    ]),
  ).toThrow();
  expect(() =>
    fitAgeAI([
      { date: "2023-01-01", minutes: 2 },
      { date: "2024-01-01", minutes: 1 },
    ]),
  ).toThrow();
});
it("joins current levels without a value jump and keeps bounded human involvement", () => {
  expect(ageAIIndices(AGE_AI_AS_OF)).toEqual([43, 89]);
  expect(ageAIIndices(AGE_AI_AS_OF, 55, 76)).toEqual([55, 76]);
  const points = ageAIPoints();
  expect(points[0].point_date).toBe(AGE_AI_AS_OF);
  expect(points.at(-1)?.point_date).toBe(MAX_DATE);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    expect(time(p.point_date)).toBeGreaterThanOrEqual(time(AGE_AI_AS_OF));
    expect(Number.isFinite(p.technology_index)).toBe(true);
    expect(p.technology_index).toBeGreaterThanOrEqual(43);
    expect(p.technology_index).toBeLessThanOrEqual(100);
    expect(p.human_effort_index).toBeGreaterThanOrEqual(25);
    expect(p.human_effort_index).toBeLessThanOrEqual(89);
    if (i) {
      expect(p.technology_index).toBeGreaterThanOrEqual(
        points[i - 1].technology_index,
      );
      expect(p.human_effort_index).toBeLessThanOrEqual(
        points[i - 1].human_effort_index,
      );
    }
  }
  expect(ageAIIndices("2026-10-17")[0] - 43).toBeLessThan(0.1);
});
