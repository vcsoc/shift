import { beforeEach, afterEach, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../../apps/api/src/db";
import { createServer } from "../../apps/api/src/server";
import { seed } from "../../apps/api/src/seed";
import Database from "better-sqlite3";
import { indices, time } from "../../packages/shared/src/model";
let dir: string,
  db: ReturnType<typeof openDatabase>,
  app: ReturnType<typeof createServer>;
const headers = { host: "127.0.0.1", "x-shift-admin": "local" };
const curve = {
  technology_index: 44,
  human_effort_index: 76,
  rationale: "Illustrative event-level values.",
};
const fixture = {
  title: "Unified event",
  kind: "approximate_history",
  date_precision: "day",
  historical_date_start: "1950-02-03",
  category_id: "computing",
  summary: "An event with an editable curve point.",
  status: "published",
  sources: [],
  curve,
};
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shift-event-points-"));
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
async function timeline(s = "baseline") {
  return (await request("GET", "/api/v1/timeline?scenario=" + s)).json();
}
it("every event coexists with an interpolated point without changing original curve values", async () => {
  const data = await timeline();
  for (const e of data.events) {
    const date =
      e.historical_date_start || e.forecasts?.baseline.estimated_start;
    if (date)
      expect(data.points.some((p: any) => p.point_date === date)).toBe(true);
  }
  expect(indices(data.points, time("2026-10-13"))).toEqual([43, 89]);
});
it("saves event and values atomically, moving both when the event date changes", async () => {
  const id = (await request("POST", "/api/v1/events", fixture)).json().id;
  expect(indices((await timeline()).points, time("1950-02-03"))).toEqual([
    44, 76,
  ]);
  await request("PATCH", "/api/v1/events/" + id, {
    historical_date_start: "1950-02-04",
    curve: { ...curve, technology_index: 55 },
  });
  const points = (await timeline()).points;
  expect(points.some((p: any) => p.point_date === "1950-02-03")).toBe(false);
  expect(indices(points, time("1950-02-04"))).toEqual([55, 76]);
  for (const s of ["accelerated", "exponential"])
    expect(indices((await timeline(s)).points, time("1950-02-04"))).toEqual([
      55, 76,
    ]);
  const invalid = await request("PATCH", "/api/v1/events/" + id, {
    title: "Invalid update",
    curve: { ...curve, technology_index: 101 },
  });
  expect(invalid.statusCode).toBe(400);
  expect((await request("GET", "/api/v1/events/" + id)).json().title).toBe(
    fixture.title,
  );
});
it("archiving/deleting removes event contribution, restoring brings back both", async () => {
  const id = (await request("POST", "/api/v1/events", fixture)).json().id;
  await request("PATCH", "/api/v1/events/" + id, { status: "archived" });
  expect(
    (await timeline()).points.some((p: any) => p.point_date === "1950-02-03"),
  ).toBe(false);
  await request("POST", "/api/v1/events/" + id + "/restore");
  expect(indices((await timeline()).points, time("1950-02-03"))).toEqual([
    44, 76,
  ]);
  await request("DELETE", "/api/v1/events/" + id);
  expect(
    (await timeline()).points.some((p: any) => p.point_date === "1950-02-03"),
  ).toBe(false);
  await request("POST", "/api/v1/events/" + id + "/restore");
  expect(indices((await timeline()).points, time("1950-02-03"))).toEqual([
    44, 76,
  ]);
});
it("same-date conflicts are rejected and restoring cannot introduce conflicting values", async () => {
  await request("POST", "/api/v1/events", fixture);
  const conflict = await request("POST", "/api/v1/events", {
    ...fixture,
    title: "Conflict",
    curve: { ...curve, technology_index: 66 },
  });
  expect(conflict.statusCode).toBe(400);
  expect(conflict.json().message).toContain("Same-date");
  const draft = (
    await request("POST", "/api/v1/events", {
      ...fixture,
      title: "Archived conflict",
      status: "archived",
      curve: { ...curve, technology_index: 66 },
    })
  ).json().id;
  expect(
    (await request("POST", "/api/v1/events/" + draft + "/restore")).statusCode,
  ).toBe(400);
  expect((await request("GET", "/api/v1/events/" + draft)).json().status).toBe(
    "archived",
  );
});
it("forecast point overrides are scenario-specific and can be cleared without changing history", async () => {
  const before = await timeline();
  const event = (await request("GET", "/api/v1/events/forecast-0")).json();
  event.forecasts.accelerated.curve = curve;
  await request("PATCH", "/api/v1/events/forecast-0", {
    forecasts: event.forecasts,
  });
  expect(
    indices((await timeline("accelerated")).points, time("2027-06-30")),
  ).toEqual([44, 76]);
  expect(
    (await timeline()).points.filter((p: any) => p.scenario_id === null),
  ).toEqual(before.points.filter((p: any) => p.scenario_id === null));
  event.forecasts.accelerated.curve = null;
  await request("PATCH", "/api/v1/events/forecast-0", {
    forecasts: event.forecasts,
  });
  expect(
    indices((await timeline("accelerated")).points, time("2027-06-30")),
  ).not.toEqual([44, 76]);
});
it("restores migration-3 backups without event-curve rows as automatic points", async () => {
  const name = (await request("POST", "/api/v1/admin/backup")).json().name;
  const snapshot = new Database(join(dir, "backups", name));
  snapshot.exec(
    "DROP TABLE event_curve_values; DELETE FROM migrations WHERE version=4;",
  );
  snapshot.close();
  await request("POST", "/api/v1/events", fixture);
  const restored = await request("POST", "/api/v1/admin/restore", {
    name,
    confirm: "RESTORE",
  });
  expect(restored.statusCode, restored.body).toBe(200);
  expect(
    (
      db.prepare("SELECT COUNT(*) AS n FROM event_curve_values").get() as {
        n: number;
      }
    ).n,
  ).toBe(0);
  expect(indices((await timeline()).points, time("2026-10-13"))).toEqual([
    43, 89,
  ]);
});
it("curve values round-trip through export/import, backup/restore and database reopen", async () => {
  const id = (await request("POST", "/api/v1/events", fixture)).json().id;
  const exported = (await request("GET", "/api/v1/export")).json();
  expect(exported.schema_version).toBe(3);
  expect(exported.events.find((e: any) => e.id === id).curve).toEqual(curve);
  expect(
    (
      await request("POST", "/api/v1/import/commit", {
        confirm: "REPLACE",
        data: exported,
      })
    ).statusCode,
  ).toBe(200);
  const backup = (await request("POST", "/api/v1/admin/backup")).json().name;
  await request("PATCH", "/api/v1/events/" + id, {
    curve: { ...curve, technology_index: 77 },
  });
  expect(
    (
      await request("POST", "/api/v1/admin/restore", {
        confirm: "RESTORE",
        name: backup,
      })
    ).statusCode,
  ).toBe(200);
  expect((await request("GET", "/api/v1/events/" + id)).json().curve).toEqual(
    curve,
  );
  await app.close();
  db.close();
  db = openDatabase(dir);
  app = createServer(db, dir);
  expect(indices((await timeline()).points, time("1950-02-03"))).toEqual([
    44, 76,
  ]);
});
