// Frozen METR-Horizon-v1.1 frontier snapshot, retrieved 2026-10-16.
// Source's benchmarkDataV1_1: release dates, p50_horizon_length (minutes), CIs.
// Only successive record-setting estimates released from 2023 through AS_OF.
export const AGE_AI_START = "2023-01-01";
export const AGE_AI_AS_OF = "2026-10-16";
export const AGE_AI_SOURCE =
  "https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/";
export const AGE_AI_OBSERVATIONS = [
  {
    model: "GPT-4",
    date: "2023-03-14",
    minutes: 3.987428,
    low: 1.93292,
    high: 7.995283,
  },
  {
    model: "GPT-4 November",
    date: "2023-11-06",
    minutes: 4.044959,
    low: 1.866859,
    high: 8.443226,
  },
  {
    model: "GPT-4o",
    date: "2024-05-13",
    minutes: 6.991195,
    low: 4.001482,
    high: 12.905741,
  },
  {
    model: "Claude 3.5 Sonnet",
    date: "2024-06-20",
    minutes: 11.395377,
    low: 5.489734,
    high: 22.384214,
  },
  {
    model: "o1-preview",
    date: "2024-09-12",
    minutes: 20.326586,
    low: 11.716193,
    high: 33.379877,
  },
  {
    model: "Claude 3.5 Sonnet October",
    date: "2024-10-22",
    minutes: 20.522872,
    low: 10.144026,
    high: 40.82028,
  },
  {
    model: "o1",
    date: "2024-12-05",
    minutes: 38.831588,
    low: 21.164512,
    high: 64.95249,
  },
  {
    model: "Claude 3.7 Sonnet",
    date: "2025-02-24",
    minutes: 60.388937,
    low: 33.006168,
    high: 104.226017,
  },
  {
    model: "o3",
    date: "2025-04-16",
    minutes: 119.732634,
    low: 74.615398,
    high: 190.943818,
  },
  {
    model: "GPT-5",
    date: "2025-08-07",
    minutes: 203.012577,
    low: 112.641357,
    high: 405.551565,
  },
  {
    model: "Gemini 3 Pro",
    date: "2025-11-18",
    minutes: 224.325884,
    low: 139.565157,
    high: 379.235434,
  },
  {
    model: "Claude Opus 4.5",
    date: "2025-11-24",
    minutes: 292.994594,
    low: 161.717714,
    high: 623.704698,
  },
  {
    model: "GPT-5.2",
    date: "2025-12-11",
    minutes: 352.249302,
    low: 198.067494,
    high: 815.177445,
  },
  {
    model: "Claude Opus 4.6",
    date: "2026-02-05",
    minutes: 718.80683,
    low: 316.685725,
    high: 3633.786163,
  },
  {
    model: "Claude Mythos Preview (early)",
    date: "2026-04-07",
    minutes: 1044.780145,
    low: 508.876789,
    high: 3304.261235,
  },
] as const;
