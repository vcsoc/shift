import { beforeEach, afterEach, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase, getEvents } from "../../apps/api/src/db";
import { seed } from "../../apps/api/src/seed";
import { createServer } from "../../apps/api/src/server";
import { SCENARIOS, indices, time } from "../../packages/shared/src/model";
let dir: string,
  db: ReturnType<typeof openDatabase>,
  app: ReturnType<typeof createServer>;
const headers = { host: "127.0.0.1", "x-shift-admin": "local" };
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shift-scenarios-"));
  db = openDatabase(dir);
  seed(db);
  app = createServer(db, dir);
});
afterEach(async () => {
  await app.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
it("all four scenarios preserve history and calculate distinct future curves", async () => {
  const data = await Promise.all(
    SCENARIOS.map(async (s) =>
      (await app.inject("/api/v1/timeline?scenario=" + s)).json(),
    ),
  );
  for (const d of data) {
    expect(d.points.filter((p: any) => p.scenario_id === null)).toEqual(
      data[0].points.filter((p: any) => p.scenario_id === null),
    );
    expect(indices(d.points, time("2020-06-01"))).toEqual(
      indices(data[0].points, time("2020-06-01")),
    );
    expect(indices(d.points, time("2026-10-13"))).toEqual([43, 89]);
    for (const p of d.points) {
      expect(p.technology_index).toBeGreaterThanOrEqual(0);
      expect(p.technology_index).toBeLessThanOrEqual(100);
      expect(p.human_effort_index).toBeGreaterThanOrEqual(0);
    }
  }
  expect(indices(data[2].points, time("2040-01-01"))[0]).toBeGreaterThan(
    indices(data[1].points, time("2040-01-01"))[0],
  );
  const events = data[2].events.filter((e: any) =>
    e.id.startsWith("future-human-"),
  );
  expect(events).toHaveLength(4);
  for (const e of events) {
    expect(e.forecasts.exponential.confidence).toBe("low");
    expect(e.forecasts.exponential.assumptions).toContain("may never occur");
    expect(e.forecasts.exponential.estimated_end).toBeTruthy();
  }
});
it("military toggle filters both past and future without changing curves or deleting data", async () => {
  const off = (
    await app.inject("/api/v1/timeline?scenario=exponential&military=0")
  ).json();
  const on = (
    await app.inject("/api/v1/timeline?scenario=exponential&military=1")
  ).json();
  expect(off.events.every((e: any) => !e.is_military)).toBe(true);
  expect(
    on.events.some((e: any) => e.is_military && e.kind === "verified_history"),
  ).toBe(true);
  expect(
    on.events.some((e: any) => e.is_military && e.kind === "future_forecast"),
  ).toBe(true);
  expect(off.points).toEqual(on.points);
  expect((await app.inject("/api/v1/timeline?military=bad")).statusCode).toBe(
    400,
  );
});
it("imports legacy two-scenario JSON safely with no invented third-scenario event dates", async () => {
  const data = (await app.inject("/api/v1/export")).json();
  expect(data.schema_version).toBe(4);
  data.schema_version = 1;
  data.scenarios = data.scenarios.filter((s: any) =>
    ["baseline", "accelerated"].includes(s.id),
  );
  data.curve_points = data.curve_points.filter(
    (p: any) =>
      p.scenario_id === null ||
      ["baseline", "accelerated"].includes(p.scenario_id),
  );
  for (const e of data.events) {
    delete e.is_military;
    if (e.forecasts) {
      delete e.forecasts.exponential;
      delete e.forecasts["age-of-ai"];
    }
  }
  const result = await app.inject({
    method: "POST",
    url: "/api/v1/import/commit",
    headers,
    payload: { confirm: "REPLACE", data },
  });
  expect(result.statusCode, result.body).toBe(200);
  const updated = (await app.inject("/api/v1/export")).json();
  expect(updated.scenarios).toHaveLength(4);
  expect(
    updated.events.find((e: any) => e.id === "forecast-0").forecasts.exponential
      .estimated_start,
  ).toBeNull();
  expect(
    updated.curve_points.some(
      (p: any) =>
        p.scenario_id === "exponential" && p.point_date === "2100-12-31",
    ),
  ).toBe(true);
});
it("upgrades an existing database once without changing edited estimates or resurrecting removed new points", async () => {
  await app.close();
  db.prepare(
    "UPDATE event_forecasts SET estimated_start='2031-06-30' WHERE event_id='forecast-0' AND scenario_id='accelerated'",
  ).run();
  db.prepare(
    "DELETE FROM event_forecasts WHERE scenario_id='exponential'",
  ).run();
  db.prepare("DELETE FROM curve_points WHERE scenario_id='exponential'").run();
  db.prepare("DELETE FROM scenarios WHERE id='exponential'").run();
  db.exec(
    "DROP INDEX event_military; ALTER TABLE events DROP COLUMN is_military; DELETE FROM migrations WHERE version=3;",
  );
  db.prepare(
    "DELETE FROM seed_log WHERE id='future-military-exponential-v2'",
  ).run();
  db.close();
  db = openDatabase(dir);
  seed(db);
  app = createServer(db, dir);
  const e = getEvents(db).find((e) => e.id === "forecast-0")!;
  expect(e.forecasts!.accelerated.estimated_start).toBe("2031-06-30");
  expect(e.forecasts!.exponential.estimated_start).toBe("2027-03-31");
  db.prepare(
    "DELETE FROM curve_points WHERE id='point-exponential-2030-01-01'",
  ).run();
  seed(db);
  expect(
    db
      .prepare(
        "SELECT id FROM curve_points WHERE id='point-exponential-2030-01-01'",
      )
      .get(),
  ).toBeUndefined();
});
