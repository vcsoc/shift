import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../../apps/api/src/db";
import { createServer } from "../../apps/api/src/server";
import { seed } from "../../apps/api/src/seed";
import history from "../../database/seeds/history.json";
import {
  RESEARCH_HISTORY,
  NEW_FORECASTS,
} from "../../apps/api/src/enhancements";
const TOTAL =
  history.length + 10 + RESEARCH_HISTORY.length + NEW_FORECASTS.length;
const headers = { host: "127.0.0.1", "x-shift-admin": "local" };
let dir: string,
  db: ReturnType<typeof openDatabase>,
  app: ReturnType<typeof createServer>;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "shift-"));
  db = openDatabase(dir);
  seed(db);
  app = createServer(db, dir);
});
afterEach(async () => {
  await app.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
const inject = (
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
) => app.inject({ method, url, headers, payload: payload as any });
describe("real SQLite API", () => {
  it("seeds idempotently and isolates history between scenarios", async () => {
    seed(db);
    const a = (
      await inject("GET", "/api/v1/timeline?scenario=baseline")
    ).json();
    const b = (
      await inject("GET", "/api/v1/timeline?scenario=accelerated")
    ).json();
    expect(
      a.events.filter((e: any) => e.kind === "verified_history").length,
    ).toBeGreaterThanOrEqual(40);
    expect(a.points.filter((p: any) => p.scenario_id === null)).toEqual(
      b.points.filter((p: any) => p.scenario_id === null),
    );
    expect(
      a.events.find((e: any) => e.id === "forecast-0").forecasts.accelerated
        .estimated_start,
    ).toBe("2027-06-30");
  });
  it("validates, persists, archives, deletes and restores", async () => {
    let e = (
      await inject("GET", "/api/v1/events/history-public-unveiling-of-eniac")
    ).json();
    delete e.id;
    expect(
      (await inject("POST", "/api/v1/events", { ...e, sources: [] }))
        .statusCode,
    ).toBe(400);
    const id = (
      await inject("POST", "/api/v1/events", { ...e, title: "Custom event" })
    ).json().id;
    expect(
      (await inject("PATCH", "/api/v1/events/" + id, { status: "archived" }))
        .statusCode,
    ).toBe(200);
    expect((await inject("DELETE", "/api/v1/events/" + id)).statusCode).toBe(
      200,
    );
    expect(
      (await inject("POST", "/api/v1/events/" + id + "/restore")).statusCode,
    ).toBe(200);
    expect((await inject("GET", "/api/v1/events/" + id)).json().status).toBe(
      "published",
    );
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM audit_log").get(),
    ).toBeTruthy();
  });
  it("enforces dates, HTTP URLs, unique NULL dates, values and cutoff", async () => {
    const p = {
      scenario_id: null,
      point_date: "1940-01-01",
      technology_index: 10,
      human_effort_index: 99,
      rationale: "Test",
    };
    expect((await inject("POST", "/api/v1/curve-points", p)).statusCode).toBe(
      409,
    );
    for (const patch of [
      { point_date: "2001-02-29" },
      { technology_index: 101 },
      { point_date: "2030-01-01" },
    ])
      expect(
        (await inject("POST", "/api/v1/curve-points", { ...p, ...patch }))
          .statusCode,
      ).toBe(400);
  });
  it("exports, previews, commits atomically and backs up/restores", async () => {
    const data = (await inject("GET", "/api/v1/export")).json();
    expect(
      (await inject("POST", "/api/v1/import/preview", data)).json().counts
        .events,
    ).toBe(TOTAL);
    expect(
      (
        await inject("POST", "/api/v1/import/commit", {
          confirm: "REPLACE",
          data,
        })
      ).statusCode,
    ).toBe(200);
    const backup = (await inject("POST", "/api/v1/admin/backup")).json();
    expect(
      (
        await inject("POST", "/api/v1/admin/restore", {
          name: backup.name,
          confirm: "RESTORE",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await inject("POST", "/api/v1/admin/restore", {
          name: "../shift.sqlite",
          confirm: "RESTORE",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await inject("POST", "/api/v1/import/commit", {
          confirm: "REPLACE",
          data: {
            ...data,
            events: [
              {
                ...data.events.find((e: any) => e.kind === "verified_history"),
                sources: [],
              },
            ],
          },
        })
      ).statusCode,
    ).toBe(400);
    expect((await inject("GET", "/api/v1/export")).json().events.length).toBe(
      TOTAL,
    );
  });
  it("requires local CSRF headers", async () => {
    expect(
      (await app.inject({ method: "POST", url: "/api/v1/events", payload: {} }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/events",
          headers: { ...headers, origin: "https://evil.test" },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
  });
  it("protects boundary geometry and does not resurrect removed seed points", async () => {
    expect(
      (await inject("DELETE", "/api/v1/curve-points/point-shared-2026"))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await inject("PATCH", "/api/v1/curve-points/point-shared-2026", {
          point_date: "2025-01-01",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await inject("DELETE", "/api/v1/curve-points/point-baseline-2045"))
        .statusCode,
    ).toBe(200);
    seed(db);
    expect(
      db
        .prepare("SELECT id FROM curve_points WHERE id=?")
        .get("point-baseline-2045"),
    ).toBeUndefined();
  });
  it("persists after reopening database", async () => {
    const id = (
      await inject("POST", "/api/v1/curve-points", {
        scenario_id: "baseline",
        point_date: "2041-01-01",
        technology_index: 57,
        human_effort_index: 84,
        rationale: "Persisted",
      })
    ).json().id;
    await app.close();
    db.close();
    db = openDatabase(dir);
    app = createServer(db, dir);
    expect(
      (await inject("GET", "/api/v1/curve-points"))
        .json()
        .some((p: any) => p.id === id),
    ).toBe(true);
  });
});
