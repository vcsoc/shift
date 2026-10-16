import { CUTOFF, MAX_DATE, Point, time } from "./model";
// METR's March 2025 task-horizon estimate is a scenario input, not a universal AI law.
export const HORIZON_DOUBLING_MONTHS = 7;
export const EXPONENTIAL_DATES = [
  "2027-03-31",
  "2027-09-30",
  "2027-12-31",
  "2029-06-30",
  "2028-06-30",
  "2031-01-01",
  "2032-01-01",
  "2035-01-01",
  "2028-12-31",
  "2033-01-01",
];
export function exponentialPoints(technology = 43, human = 89): Point[] {
  const dates: string[] = [];
  for (let year = 2027; year <= 2040; year++)
    for (const month of [1, 4, 7, 10])
      dates.push(`${year}-${String(month).padStart(2, "0")}-01`);
  dates.push("2050-01-01", "2075-01-01", MAX_DATE);
  return dates.map((date) => {
    const years = (time(date) - time(CUTOFF)) / (365.2425 * 86400000);
    // Benchmark horizon doubles every 7 months; adoption attenuates that growth.
    // These mappings are explicitly subjective and not fitted to historical index values.
    const adoption = Math.expm1(
      ((Math.LN2 * years) / (HORIZON_DOUBLING_MONTHS / 12)) * 0.45,
    );
    return {
      id: `point-exponential-${date}`,
      scenario_id: "exponential",
      point_date: date,
      technology_index: Number(
        (100 - (100 - technology) / (1 + 0.16 * adoption)).toFixed(4),
      ),
      human_effort_index: Number(
        (
          Math.min(5, human) +
          (human - Math.min(5, human)) / (1 + 0.12 * adoption)
        ).toFixed(4),
      ),
      rationale:
        "Speculative continuation of METR March 2025 ~7-month task-horizon doubling; 0.45 adoption attenuation, 0.16 technology/0.12 effort mapping. Bounded indices, not measured capabilities. Growth and institutional change may stall.",
    };
  });
}
