import { beforeEach, afterEach, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { openDatabase } from "../../apps/api/src/db";
import { seed } from "../../apps/api/src/seed";
import { createServer } from "../../apps/api/src/server";
import { AGE_AI_AS_OF } from "../../packages/shared/src/age-ai";
import { CUTOFF, indices, time } from "../../packages/shared/src/model";
let dir: string,
  db: ReturnType<typeof openDatabase>,
  app: ReturnType<typeof createServer>;
const headers = { host: "127.0.0.1", "x-shift-admin": "local" };
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shift-age-ai-"));
  db = openDatabase(dir);
  seed(db);
  app = createServer(db, dir);
});
afterEach(async () => {
  await app.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const request = (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
) => app.inject({ method, url, headers, payload: payload as any });
it("shows full historical context, with a separate recent-data forecast and no invented responsibility end dates", async () => {
  const baseline = (await request("GET", "/api/v1/timeline")).json();
  const age = (
    await request("GET", "/api/v1/timeline?scenario=age-of-ai")
  ).json();
  expect(age.cutoff).toBe(AGE_AI_AS_OF);
  expect(age.points.filter((p: any) => p.point_date <= CUTOFF)).toEqual(
    baseline.points.filter((p: any) => p.point_date <= CUTOFF),
  );
  for (const date of [
    "1900-01-01",
    "1950-01-01",
    "2000-01-01",
    "2023-01-01",
    CUTOFF,
  ])
    expect(indices(age.points, time(date))).toEqual(
      indices(baseline.points, time(date)),
    );
  expect(
    age.events.some((e: any) => e.historical_date_start < "2023-01-01"),
  ).toBe(true);
  expect(indices(age.points, time(AGE_AI_AS_OF))).toEqual([43, 89]);
  expect(indices(age.points, time("2035-01-01"))[0]).toBeGreaterThan(
    indices(baseline.points, time("2035-01-01"))[0],
  );
  const exported = (await request("GET", "/api/v1/export")).json();
  for (const e of exported.events.filter(
    (e: any) =>
      e.kind === "future_forecast" && !e.id.startsWith("age-ai-projection-"),
  )) {
    expect(e.forecasts["age-of-ai"].estimated_start).toBeNull();
    expect(e.forecasts["age-of-ai"].assumptions).toContain("remain required");
  }
});
it("keeps forecast points editable and protected boundaries stable, without reseeding edits or deletions", async () => {
  const id = "point-age-of-ai-2030-01-01";
  expect(
    (
      await request("PATCH", "/api/v1/curve-points/" + id, {
        technology_index: 77,
      })
    ).statusCode,
  ).toBe(200);
  const removed = "point-age-of-ai-2031-01-01";
  expect(
    (await request("DELETE", "/api/v1/curve-points/" + removed)).statusCode,
  ).toBe(200);
  seed(db);
  expect(
    (
      db
        .prepare("SELECT technology_index FROM curve_points WHERE id=?")
        .get(id) as any
    ).technology_index,
  ).toBe(77);
  expect(
    db.prepare("SELECT id FROM curve_points WHERE id=?").get(removed),
  ).toBeUndefined();
  const origin = "point-age-of-ai-" + AGE_AI_AS_OF;
  expect(
    (await request("DELETE", "/api/v1/curve-points/" + origin)).statusCode,
  ).toBe(400);
  expect(
    (
      await request("PATCH", "/api/v1/curve-points/" + origin, {
        point_date: "2027-01-02",
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await request("POST", "/api/v1/curve-points", {
        scenario_id: "age-of-ai",
        point_date: "2024-01-01",
        technology_index: 20,
        human_effort_index: 90,
        rationale: "Not an Age of AI forecast date",
      })
    ).statusCode,
  ).toBe(400);
});
it.each([2, 3])(
  "upgrades version %s JSON while preserving existing history and estimates",
  async (version) => {
    const data = (await request("GET", "/api/v1/export")).json();
    data.schema_version = version;
    data.scenarios = data.scenarios.filter((s: any) => s.id !== "age-of-ai");
    data.curve_points = data.curve_points.filter(
      (p: any) => p.scenario_id !== "age-of-ai",
    );
    for (const e of data.events)
      if (e.forecasts) delete e.forecasts["age-of-ai"];
    data.events.find(
      (e: any) => e.id === "forecast-0",
    ).forecasts.baseline.estimated_start = "2041-06-30";
    const result = await request("POST", "/api/v1/import/commit", {
      confirm: "REPLACE",
      data,
    });
    expect(result.statusCode, result.body).toBe(200);
    const updated = (await request("GET", "/api/v1/export")).json();
    expect(updated.schema_version).toBe(4);
    expect(updated.scenarios).toHaveLength(4);
    expect(
      updated.events.find((e: any) => e.id === "forecast-0").forecasts.baseline
        .estimated_start,
    ).toBe("2041-06-30");
    const coordinates = (points: any[]) =>
      points
        .filter((p) => p.scenario_id === null)
        .map((p) => [
          p.id,
          p.point_date,
          p.technology_index,
          p.human_effort_index,
          p.rationale,
        ]);
    expect(coordinates(updated.curve_points)).toEqual(
      coordinates(data.curve_points),
    );
    expect(
      updated.events.find((e: any) => e.id === "forecast-0").forecasts[
        "age-of-ai"
      ].estimated_start,
    ).toBeNull();
  },
);
it("restores a pre-Age-of-AI SQLite backup and upgrades only the new scenario", async () => {
  const { name } = (await request("POST", "/api/v1/admin/backup")).json();
  const snapshot = new Database(join(dir, "backups", name));
  snapshot.pragma("foreign_keys = ON");
  snapshot.exec(
    "DELETE FROM events WHERE id LIKE 'age-ai-projection-%'; DELETE FROM event_curve_values WHERE series='age-of-ai'; DELETE FROM event_forecasts WHERE scenario_id='age-of-ai'; DELETE FROM curve_points WHERE scenario_id='age-of-ai'; DELETE FROM scenarios WHERE id='age-of-ai'; DELETE FROM seed_log WHERE id IN ('age-of-ai-v1','age-of-ai-v2','age-of-ai-v3','age-of-ai-checkpoints-v1'); DELETE FROM migrations WHERE version=5;",
  );
  snapshot
    .prepare(
      "UPDATE event_forecasts SET estimated_start='2041-06-30' WHERE event_id='forecast-0' AND scenario_id='baseline'",
    )
    .run();
  snapshot.close();
  const result = await request("POST", "/api/v1/admin/restore", {
    name,
    confirm: "RESTORE",
  });
  expect(result.statusCode, result.body).toBe(200);
  const restored = (await request("GET", "/api/v1/export")).json();
  expect(restored.scenarios).toHaveLength(4);
  expect(
    restored.events.find((e: any) => e.id === "forecast-0").forecasts.baseline
      .estimated_start,
  ).toBe("2041-06-30");
  expect(
    indices(
      (await request("GET", "/api/v1/timeline?scenario=age-of-ai")).json()
        .points,
      time("2000-01-01"),
    ),
  ).toEqual([25, 92]);
});
it("validates Age of AI boundary imports atomically and persists its own event values", async () => {
  const data = (await request("GET", "/api/v1/export")).json();
  const e = data.events.find((e: any) => e.id === "forecast-0");
  e.forecasts["age-of-ai"] = {
    ...e.forecasts["age-of-ai"],
    estimated_start: "2030-06-30",
    curve: {
      technology_index: 80,
      human_effort_index: 40,
      rationale: "Editable conditional values",
    },
  };
  expect(
    (
      await request("POST", "/api/v1/import/commit", {
        confirm: "REPLACE",
        data,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    indices(
      (await request("GET", "/api/v1/timeline?scenario=age-of-ai")).json()
        .points,
      time("2030-06-30"),
    ),
  ).toEqual([80, 40]);
  data.curve_points = data.curve_points.filter(
    (p: any) =>
      !(p.scenario_id === "age-of-ai" && p.point_date === AGE_AI_AS_OF),
  );
  expect(
    (
      await request("POST", "/api/v1/import/commit", {
        confirm: "REPLACE",
        data,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (await request("GET", "/api/v1/export"))
      .json()
      .curve_points.some(
        (p: any) =>
          p.scenario_id === "age-of-ai" && p.point_date === AGE_AI_AS_OF,
      ),
  ).toBe(true);
});
it("upgrades a two-scenario installation before older seeds save new forecasts", () => {
  db.exec(`
    DELETE FROM events WHERE id LIKE 'age-ai-%' OR id LIKE 'future-human-%'
      OR id='future-four-backstops-end' OR id LIKE 'military-future-%';
    DELETE FROM event_forecasts WHERE scenario_id IN ('exponential','age-of-ai');
    DELETE FROM curve_points WHERE scenario_id IN ('exponential','age-of-ai');
    DELETE FROM scenarios WHERE id IN ('exponential','age-of-ai');
    DELETE FROM seed_log WHERE id IN ('future-military-exponential-v2','age-of-ai-v1','age-of-ai-v2','age-of-ai-v3','age-of-ai-checkpoints-v1');
  `);
  expect(() => seed(db)).not.toThrow();
  expect(
    (db.prepare("SELECT COUNT(*) AS n FROM scenarios").get() as any).n,
  ).toBe(4);
  expect(db.pragma("foreign_key_check")).toEqual([]);
  expect(
    db
      .prepare(
        "SELECT estimated_start FROM event_forecasts WHERE event_id='forecast-0' AND scenario_id='exponential'",
      )
      .get(),
  ).toEqual({ estimated_start: "2027-03-31" });
});
it("adds five sourced explanation markers only to Age of AI without reshaping its curve", async () => {
  const age = (
    await request("GET", "/api/v1/timeline?scenario=age-of-ai")
  ).json();
  const checkpoints = age.events.filter((e: any) =>
    e.id.startsWith("age-ai-projection-"),
  );
  expect(checkpoints).toHaveLength(5);
  for (const e of checkpoints) {
    expect(e.forecasts["age-of-ai"].description).toContain(
      "Projection checkpoint",
    );
    expect(e.forecasts["age-of-ai"].rationale).toContain("124.8 days");
    expect(e.forecasts["age-of-ai"].confidence).toBe("low");
    expect(e.forecasts.baseline.estimated_start).toBeNull();
    expect(e.forecasts.accelerated.estimated_start).toBeNull();
    expect(e.forecasts.exponential.estimated_start).toBeNull();
    expect(e.sources).toHaveLength(3);
    const date = e.forecasts["age-of-ai"].estimated_start;
    expect(age.points.some((p: any) => p.point_date === date)).toBe(true);
    expect(e.forecasts["age-of-ai"].curve).toBeUndefined();
  }
  await request("DELETE", "/api/v1/events/age-ai-projection-2030");
  seed(db);
  const updated = (
    await request("GET", "/api/v1/timeline?scenario=age-of-ai")
  ).json();
  expect(
    updated.events.some((e: any) => e.id === "age-ai-projection-2030"),
  ).toBe(false);
  expect(updated.points).toEqual(age.points);
});
