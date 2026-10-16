import Fastify from "fastify";
import staticPlugin from "@fastify/static";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import {
  audit,
  DB,
  exportData,
  getEvents,
  points,
  saveEvent,
  savePoint,
} from "./db";
import {
  CUTOFF,
  eventSchema,
  pointSchema,
  scenarioSchema,
  SCENARIOS,
} from "../../../packages/shared/src/model";
import { upgradeImport } from "./imports";
import {
  timelinePoints,
  validateEventCurves,
} from "../../../packages/shared/src/event-points";
const scenarioEdit = z.object({
  name: z.string().min(1),
  description: z.string(),
  assumptions: z.string(),
});
const categorySchema = z.object({
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  name: z.string().min(1),
  parent_id: z.string().nullable().default(null),
});
const bundle = z.object({
  schema_version: z.literal(3),
  scenarios: z
    .array(
      scenarioEdit.extend({
        id: scenarioSchema,
        is_default: z.number().optional(),
      }),
    )
    .length(3),
  categories: z.array(categorySchema.extend({ id: z.string().min(1) })),
  events: z.array(
    eventSchema.safeExtend({
      id: z.string().min(1),
      deleted_at: z.string().nullable().optional(),
    }),
  ),
  curve_points: z.array(pointSchema.safeExtend({ id: z.string().min(1) })),
});
export function createServer(db: DB, dataDir = process.env.DATA_DIR || "data") {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    bodyLimit: 5 * 1024 * 1024,
  });
  let cache = new Map<string, unknown>();
  app.addHook("onRequest", async (req, reply) => {
    if (["POST", "PATCH", "DELETE"].includes(req.method)) {
      const host = req.headers.host || "",
        origin = req.headers.origin;
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))
        return reply.code(403).send({
          code: "LOCAL_ONLY",
          message: "Admin writes require localhost",
          fieldErrors: {},
        });
      if (
        req.headers["x-shift-admin"] !== "local" ||
        (origin &&
          (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(
            origin,
          ) ||
            new URL(origin).host !== host))
      )
        return reply.code(403).send({
          code: "CSRF",
          message: "Local admin header and origin required",
          fieldErrors: {},
        });
    }
  });
  app.addHook("onResponse", async (req) => {
    if (req.method !== "GET") cache.clear();
  });
  app.setErrorHandler((err, req, reply) => {
    const e = err as Error;
    if (e instanceof ZodError)
      return reply.code(400).send({
        code: "VALIDATION",
        message: "Check the highlighted fields",
        fieldErrors: z.flattenError(e).fieldErrors,
        issues: e.issues,
      });
    const constraint = e.message.includes("constraint");
    reply.code(constraint ? 409 : 400).send({
      code: constraint ? "CONFLICT" : "BAD_REQUEST",
      message: e.message,
      fieldErrors: {},
    });
  });
  const need = (table: string, id: string) => {
    if (!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(id))
      throw new Error("Record not found");
  };
  app.get("/api/v1/health", async () => ({ ok: true }));
  app.get("/api/v1/timeline", async (req) => {
    const s = scenarioSchema.parse(
      (req.query as { scenario?: string }).scenario || "baseline",
    );
    const military =
      z
        .enum(["0", "1"])
        .parse((req.query as { military?: string }).military || "0") === "1";
    const key = `${s}:${military}`;
    if (cache.has(key)) return cache.get(key);
    const result = {
      scenario: s,
      cutoff: CUTOFF,
      events: getEvents(db).filter(
        (e) =>
          e.status === "published" &&
          !e.deleted_at &&
          (military || !e.is_military),
      ),
      points: timelinePoints(points(db), getEvents(db), s),
      categories: db.prepare("SELECT * FROM categories").all(),
    };
    cache.set(key, result);
    return result;
  });
  app.get("/api/v1/events", async (req) => {
    const q = req.query as Record<string, string>;
    const all = getEvents(db).filter(
      (e) =>
        (!q.search || e.title.toLowerCase().includes(q.search.toLowerCase())) &&
        (!q.category || e.category_id === q.category) &&
        (!q.status || e.status === q.status) &&
        (!q.scenario ||
          e.kind !== "future_forecast" ||
          e.forecasts?.[scenarioSchema.parse(q.scenario)].estimated_start),
    );
    const offset = Math.max(0, Number(q.offset) || 0),
      limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
    return { items: all.slice(offset, offset + limit), total: all.length };
  });
  app.get<{ Params: { id: string } }>(
    "/api/v1/events/:id",
    async (req, reply) => {
      const e = getEvents(db).find((e) => e.id === req.params.id);
      return (
        e ||
        reply.code(404).send({
          code: "NOT_FOUND",
          message: "Event not found",
          fieldErrors: {},
        })
      );
    },
  );
  app.post("/api/v1/events", async (req, reply) => {
    const input = eventSchema.parse(req.body);
    if (
      input.id &&
      db.prepare("SELECT id FROM events WHERE id=?").get(input.id)
    )
      throw new Error("ID conflict");
    return reply.code(201).send({ id: saveEvent(db, input) });
  });
  app.patch<{ Params: { id: string } }>("/api/v1/events/:id", async (req) => {
    need("events", req.params.id);
    const current = getEvents(db).find((e) => e.id === req.params.id)!;
    return {
      id: saveEvent(db, { ...current, ...(req.body as object) }, req.params.id),
    };
  });
  app.delete<{ Params: { id: string } }>("/api/v1/events/:id", async (req) => {
    need("events", req.params.id);
    db.transaction(() => {
      db.prepare(
        "UPDATE events SET deleted_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(req.params.id);
      audit(db, "event", req.params.id, "delete", {});
    })();
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>(
    "/api/v1/events/:id/restore",
    async (req) => {
      need("events", req.params.id);
      db.transaction(() => {
        validateEventCurves(
          getEvents(db).map((e) =>
            e.id === req.params.id
              ? { ...e, status: "published", deleted_at: null }
              : e,
          ),
        );
        db.prepare(
          "UPDATE events SET deleted_at=NULL,status='published' WHERE id=?",
        ).run(req.params.id);
        audit(db, "event", req.params.id, "restore", {});
      })();
      return { ok: true };
    },
  );
  app.get("/api/v1/scenarios", async () =>
    db.prepare("SELECT * FROM scenarios").all(),
  );
  app.patch<{ Params: { id: string } }>(
    "/api/v1/scenarios/:id",
    async (req) => {
      const id = scenarioSchema.parse(req.params.id),
        s = scenarioEdit.parse(req.body);
      db.transaction(() => {
        db.prepare(
          "UPDATE scenarios SET name=?,description=?,assumptions=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(s.name, s.description, s.assumptions, id);
        audit(db, "scenario", id, "save", s);
      })();
      return { ok: true };
    },
  );
  app.get("/api/v1/curve-points", async (req) => {
    const s = scenarioSchema.parse(
      (req.query as { scenario?: string }).scenario || "baseline",
    );
    return points(db).filter(
      (p) => p.scenario_id === null || p.scenario_id === s,
    );
  });
  app.post("/api/v1/curve-points", async (req, reply) =>
    reply.code(201).send({ id: savePoint(db, req.body) }),
  );
  app.patch<{ Params: { id: string } }>(
    "/api/v1/curve-points/:id",
    async (req) => {
      need("curve_points", req.params.id);
      const old = points(db).find((p) => p.id === req.params.id)!;
      const next = pointSchema.parse({ ...old, ...(req.body as object) });
      if (next.scenario_id !== old.scenario_id)
        throw new Error("Delete and add to change point series");
      return { id: savePoint(db, next, req.params.id) };
    },
  );
  app.delete<{ Params: { id: string } }>(
    "/api/v1/curve-points/:id",
    async (req) => {
      need("curve_points", req.params.id);
      const p = points(db).find((p) => p.id === req.params.id)!;
      if (["1900-01-01", CUTOFF, "2100-12-31"].includes(p.point_date))
        throw new Error(
          "Essential boundary anchor: edit its values instead of deleting",
        );
      const all = points(db);
      if (
        p.scenario_id === null &&
        all.filter((x) => x.scenario_id === null).length <= 2
      )
        throw new Error("Keep at least two shared historical anchors");
      if (
        p.scenario_id &&
        all.filter((x) => x.scenario_id === p.scenario_id).length <= 2
      )
        throw new Error("Keep at least two scenario anchors");
      db.transaction(() => {
        db.prepare("DELETE FROM curve_points WHERE id=?").run(p.id);
        audit(db, "point", p.id, "delete", p);
      })();
      return { ok: true };
    },
  );
  app.get("/api/v1/categories", async () =>
    db.prepare("SELECT * FROM categories").all(),
  );
  app.post("/api/v1/categories", async (req) => {
    const c = categorySchema.parse(req.body),
      id = c.id || randomUUID();
    db.prepare("INSERT INTO categories VALUES(?,?,?)").run(
      id,
      c.name,
      c.parent_id,
    );
    return { id };
  });
  app.get("/api/v1/export", async () => exportData(db));
  function preview(body: unknown) {
    const parsed = bundle.parse(upgradeImport(body));
    if (new Set(parsed.scenarios.map((s) => s.id)).size !== SCENARIOS.length)
      throw new Error("Duplicate scenario");
    for (const list of [parsed.events, parsed.categories, parsed.curve_points])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        throw new Error("Duplicate IDs in import");
    const cats = new Set(parsed.categories.map((c) => c.id));
    for (const c of parsed.categories)
      if (c.parent_id && !cats.has(c.parent_id))
        throw new Error("Missing parent category");
    const ids = new Set(parsed.events.map((e) => e.id));
    for (const e of parsed.events) {
      if (!cats.has(e.category_id)) throw new Error("Missing category");
      for (const l of e.links)
        if (!ids.has(l.target_event_id))
          throw new Error("Missing related event");
    }
    const dates = new Set<string>();
    for (const p of parsed.curve_points) {
      const key = (p.scenario_id || "shared") + p.point_date;
      if (dates.has(key)) throw new Error("Duplicate point dates");
      dates.add(key);
    }
    for (const s of [null, ...SCENARIOS])
      if (parsed.curve_points.filter((p) => p.scenario_id === s).length < 2)
        throw new Error("Each series requires at least two points");
    for (const [series, date] of [
      [null, "1900-01-01"],
      [null, CUTOFF],
      ...SCENARIOS.map((s) => [s, "2100-12-31"]),
    ])
      if (
        !parsed.curve_points.some(
          (p) => p.scenario_id === series && p.point_date === date,
        )
      )
        throw new Error("Import requires start, cutoff and endpoint anchors");
    validateEventCurves(parsed.events);
    const current = exportData(db);
    return {
      parsed,
      conflicts: parsed.events
        .filter((e) => current.events.some((x) => x.id === e.id))
        .map((e) => e.id),
      counts: {
        events: parsed.events.length,
        points: parsed.curve_points.length,
      },
    };
  }
  app.post("/api/v1/import/preview", async (req) => {
    const { conflicts, counts } = preview(req.body);
    return {
      conflicts,
      counts,
      mode: "Atomic replacement; confirm before commit",
    };
  });
  app.post("/api/v1/import/commit", async (req) => {
    const b = z
      .object({ confirm: z.literal("REPLACE"), data: z.unknown() })
      .parse(req.body);
    const { parsed } = preview(b.data);
    db.transaction(() => {
      for (const t of [
        "event_curve_values",
        "event_links",
        "event_sources",
        "event_forecasts",
        "events",
        "curve_points",
        "categories",
      ])
        db.prepare(`DELETE FROM ${t}`).run();
      for (const s of parsed.scenarios)
        db.prepare(
          "UPDATE scenarios SET name=?,description=?,assumptions=? WHERE id=?",
        ).run(s.name, s.description, s.assumptions, s.id);
      const pending = [...parsed.categories];
      while (pending.length) {
        const index = pending.findIndex(
          (c) =>
            !c.parent_id ||
            db.prepare("SELECT id FROM categories WHERE id=?").get(c.parent_id),
        );
        if (index < 0) throw new Error("Category cycle");
        const [c] = pending.splice(index, 1);
        db.prepare("INSERT INTO categories VALUES(?,?,?)").run(
          c.id,
          c.name,
          c.parent_id,
        );
      }
      for (const e of parsed.events) {
        saveEvent(db, { ...e, links: [] });
        if (e.deleted_at)
          db.prepare("UPDATE events SET deleted_at=? WHERE id=?").run(
            e.deleted_at,
            e.id,
          );
      }
      for (const e of parsed.events)
        for (const l of e.links)
          db.prepare("INSERT INTO event_links VALUES(?,?,?,?)").run(
            e.id,
            l.target_event_id,
            l.relationship,
            l.explanation,
          );
      for (const p of parsed.curve_points) savePoint(db, p);
      audit(db, "database", "all", "import", {});
    })();
    return { ok: true };
  });
  const backupDir = resolve(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  app.post("/api/v1/admin/backup", async () => {
    const name = `backup-${Date.now()}-${randomUUID()}.sqlite`;
    await db.backup(resolve(backupDir, name));
    return { name };
  });
  app.get("/api/v1/admin/backups", async () =>
    readdirSync(backupDir).filter((n) => /^backup-[\w-]+\.sqlite$/.test(n)),
  );
  app.post("/api/v1/admin/restore", async (req) => {
    const b = z
      .object({
        name: z.string().regex(/^backup-[\w-]+\.sqlite$/),
        confirm: z.literal("RESTORE"),
      })
      .parse(req.body);
    if (!existsSync(resolve(backupDir, b.name)))
      throw new Error("Backup not found");
    const { default: Database } = await import("better-sqlite3");
    const backup = new Database(resolve(backupDir, b.name), { readonly: true });
    try {
      if (backup.pragma("integrity_check", { simple: true }) !== "ok")
        throw new Error("Backup integrity check failed");
      if ((backup.pragma("foreign_key_check") as unknown[]).length)
        throw new Error("Backup contains invalid references");
      if (
        !backup.prepare("SELECT version FROM migrations WHERE version=3").get()
      )
        throw new Error(
          "Older SQLite backup schema: export JSON with the original app and import that JSON here.",
        );
      preview(exportData(backup));
      db.prepare("ATTACH DATABASE ? AS restore_snapshot").run(
        resolve(backupDir, b.name),
      );
      try {
        db.transaction(() => {
          db.pragma("defer_foreign_keys = ON");
          const tables = [
            "scenarios",
            "categories",
            "events",
            "event_forecasts",
            "event_sources",
            "curve_points",
            "event_links",
            "event_curve_values",
            "audit_log",
            "seed_log",
          ];
          for (const table of [...tables].reverse())
            db.prepare(`DELETE FROM ${table}`).run();
          for (const table of tables) {
            if (
              table === "event_curve_values" &&
              !backup
                .prepare(
                  "SELECT name FROM sqlite_master WHERE name='event_curve_values'",
                )
                .get()
            )
              continue;
            db.prepare(
              `INSERT INTO ${table} SELECT * FROM restore_snapshot.${table}`,
            ).run();
          }
          audit(db, "database", "all", "restore", { backup: b.name });
        })();
      } finally {
        db.exec("DETACH DATABASE restore_snapshot");
      }
      return { ok: true };
    } finally {
      backup.close();
    }
  });
  if (existsSync(resolve("dist/index.html"))) {
    app.register(staticPlugin, { root: resolve("dist") });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({
            code: "NOT_FOUND",
            message: "Unknown API endpoint",
            fieldErrors: {},
          })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
