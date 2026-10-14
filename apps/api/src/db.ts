import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import {
  Event,
  eventSchema,
  Point,
  pointSchema,
  Scenario,
} from "../../../packages/shared/src/model";
export function openDatabase(dir = process.env.DATA_DIR || "data") {
  mkdirSync(dir, { recursive: true });
  const db = new Database(resolve(dir, "shift.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  if (
    !db.prepare("SELECT name FROM sqlite_master WHERE name='migrations'").get()
  )
    db.exec(readFileSync(resolve("database/migrations/001.sql"), "utf8"));
  if (!db.prepare("SELECT version FROM migrations WHERE version=2").get())
    db.transaction(() =>
      db.exec(readFileSync(resolve("database/migrations/002.sql"), "utf8")),
    )();
  return db;
}
export type DB = ReturnType<typeof openDatabase>;
export function audit(
  db: DB,
  type: string,
  id: string,
  action: string,
  data: unknown,
) {
  db.prepare(
    "INSERT INTO audit_log(entity_type,entity_id,action,change_json) VALUES(?,?,?,?)",
  ).run(type, id, action, JSON.stringify(data));
}
export function getEvents(db: DB): Event[] {
  return (
    db
      .prepare("SELECT * FROM events ORDER BY historical_date_start,title")
      .all() as Event[]
  ).map((e) => {
    const f = db
      .prepare("SELECT * FROM event_forecasts WHERE event_id=?")
      .all(e.id) as ({ scenario_id: Scenario } & NonNullable<
      Event["forecasts"]
    >["baseline"])[];
    return {
      ...e,
      sources: db
        .prepare(
          "SELECT publisher,title,url,accessed_at FROM event_sources WHERE event_id=?",
        )
        .all(e.id) as Event["sources"],
      links: db
        .prepare(
          "SELECT target_event_id,relationship,explanation FROM event_links WHERE source_event_id=?",
        )
        .all(e.id) as Event["links"],
      ...(f.length
        ? {
            forecasts: Object.fromEntries(
              f.map((x) => [x.scenario_id, x]),
            ) as unknown as Event["forecasts"],
          }
        : {}),
    };
  });
}
export function saveEvent(db: DB, input: unknown, id?: string) {
  const e = eventSchema.parse(input);
  const key = id || e.id || randomUUID();
  return db.transaction(() => {
    db.prepare(
      `INSERT INTO events(id,title,kind,date_precision,historical_date_start,historical_date_end,category_id,summary,impact,technology_type,status) VALUES(@id,@title,@kind,@date_precision,@historical_date_start,@historical_date_end,@category_id,@summary,@impact,@technology_type,@status) ON CONFLICT(id) DO UPDATE SET title=excluded.title,kind=excluded.kind,date_precision=excluded.date_precision,historical_date_start=excluded.historical_date_start,historical_date_end=excluded.historical_date_end,category_id=excluded.category_id,summary=excluded.summary,impact=excluded.impact,technology_type=excluded.technology_type,status=excluded.status,updated_at=CURRENT_TIMESTAMP`,
    ).run({ ...e, id: key });
    for (const table of ["event_sources", "event_forecasts"])
      db.prepare(`DELETE FROM ${table} WHERE event_id=?`).run(key);
    db.prepare("DELETE FROM event_links WHERE source_event_id=?").run(key);
    for (const s of e.sources)
      db.prepare(
        "INSERT INTO event_sources(id,event_id,publisher,title,url,accessed_at) VALUES(?,?,?,?,?,?)",
      ).run(randomUUID(), key, s.publisher, s.title, s.url, s.accessed_at);
    if (e.forecasts)
      for (const [scenario, f] of Object.entries(e.forecasts))
        db.prepare(
          "INSERT INTO event_forecasts(event_id,scenario_id,estimated_start,estimated_end,description,rationale,assumptions,confidence) VALUES(?,?,?,?,?,?,?,?)",
        ).run(
          key,
          scenario,
          f.estimated_start,
          f.estimated_end,
          f.description,
          f.rationale,
          f.assumptions,
          f.confidence,
        );
    for (const l of e.links)
      db.prepare("INSERT INTO event_links VALUES(?,?,?,?)").run(
        key,
        l.target_event_id,
        l.relationship,
        l.explanation,
      );
    audit(db, "event", key, "save", e);
    return key;
  })();
}
export function points(db: DB) {
  return db
    .prepare("SELECT * FROM curve_points ORDER BY point_date")
    .all() as Point[];
}
export function savePoint(db: DB, input: unknown, id?: string) {
  const p = pointSchema.parse(input),
    key = id || p.id || randomUUID();
  const old = db.prepare("SELECT * FROM curve_points WHERE id=?").get(key) as
    Point | undefined;
  if (
    old &&
    ["1900-01-01", "2026-10-13", "2100-12-31"].includes(old.point_date) &&
    (old.point_date !== p.point_date || old.scenario_id !== p.scenario_id)
  )
    throw new Error("Essential boundary anchors cannot change dates or series");
  db.transaction(() => {
    db.prepare(
      `INSERT INTO curve_points(id,scenario_id,point_date,technology_index,human_effort_index,rationale) VALUES(@id,@scenario_id,@point_date,@technology_index,@human_effort_index,@rationale) ON CONFLICT(id) DO UPDATE SET scenario_id=excluded.scenario_id,point_date=excluded.point_date,technology_index=excluded.technology_index,human_effort_index=excluded.human_effort_index,rationale=excluded.rationale,updated_at=CURRENT_TIMESTAMP`,
    ).run({ ...p, id: key });
    audit(db, "point", key, "save", p);
  })();
  return key;
}
export function exportData(db: DB) {
  return {
    schema_version: 1,
    scenarios: db.prepare("SELECT * FROM scenarios").all(),
    categories: db.prepare("SELECT * FROM categories").all(),
    events: getEvents(db),
    curve_points: points(db),
  };
}
