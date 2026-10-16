import { DB, audit, savePoint, saveEvent } from "./db";
import {
  AGE_AI_SCENARIO,
  AGE_AI_ASSUMPTIONS,
  AGE_AI_OBSERVATIONS,
  AGE_AI_SOURCE,
  AGE_AI_AS_OF,
  ageAIPoints,
} from "../../../packages/shared/src/age-ai";
import {
  CUTOFF,
  AGE_AI_NOT_FORECAST,
} from "../../../packages/shared/src/model";
export function seedAgeAI(db: DB) {
  if (db.prepare("SELECT id FROM seed_log WHERE id='age-of-ai-v3'").get())
    return;
  db.transaction(() => {
    // Replace only unedited points from the in-session recent-history prototype.
    if (db.prepare("SELECT id FROM seed_log WHERE id='age-of-ai-v1'").get())
      db.prepare(
        "DELETE FROM curve_points WHERE scenario_id='age-of-ai' AND id='point-age-of-ai-' || point_date AND created_at=updated_at",
      ).run();
    db.prepare(
      "INSERT OR IGNORE INTO scenarios(id,name,description,assumptions,is_default) VALUES(@id,@name,@description,@assumptions,@is_default)",
    ).run(AGE_AI_SCENARIO);
    // Update only the untouched metadata from the initial in-session prototype.
    db.prepare(
      "UPDATE scenarios SET assumptions=?,updated_at=CURRENT_TIMESTAMP WHERE id='age-of-ai' AND assumptions=?",
    ).run(
      AGE_AI_ASSUMPTIONS,
      "2023–2026 METR software-task capability fit, continued conditionally. 50% benchmark success is not production reliability. The 8-hour scale, effort mapping and 25-point human floor are subjective, not observed declines in work or responsibility. Accountability, governance, auditing and escalation remain human responsibilities; adoption may stall. No sector or human-role cessation dates are inferred.",
    );
    // Default to not forecast: do not copy another scenario's invented dates.
    const missing = AGE_AI_NOT_FORECAST;
    const insert = db.prepare(
      "INSERT OR IGNORE INTO event_forecasts(event_id,scenario_id,estimated_start,estimated_end,description,rationale,assumptions,confidence) VALUES(?,'age-of-ai',NULL,NULL,?,?,?,?)",
    );
    for (const e of db
      .prepare("SELECT id FROM events WHERE kind='future_forecast'")
      .all() as { id: string }[])
      insert.run(
        e.id,
        missing.description,
        missing.rationale,
        missing.assumptions,
        missing.confidence,
      );
    const anchor = db
      .prepare(
        "SELECT technology_index,human_effort_index FROM curve_points WHERE scenario_id IS NULL AND point_date=?",
      )
      .get(CUTOFF) as
      { technology_index: number; human_effort_index: number } | undefined;
    for (const point of ageAIPoints(
      anchor?.technology_index,
      anchor?.human_effort_index,
    ))
      if (
        !db
          .prepare(
            "SELECT id FROM curve_points WHERE scenario_id='age-of-ai' AND point_date=?",
          )
          .get(point.point_date)
      )
        savePoint(db, point);
    // Sourced benchmark records are observations, not claims of human replacement.
    for (const o of AGE_AI_OBSERVATIONS) {
      const id = `age-ai-metr-${o.date}`;
      if (db.prepare("SELECT id FROM events WHERE id=?").get(id)) continue;
      saveEvent(db, {
        id,
        title: `${o.model}: AI software-task horizon benchmark`,
        kind: "verified_history",
        date_precision: "day",
        historical_date_start: o.date,
        category_id: "ai",
        technology_type: "AI",
        status: "published",
        summary: `METR-Horizon-v1.1 estimates a ${o.minutes.toFixed(1)}-minute human-time task horizon at 50% success (reported interval ${o.low.toFixed(1)}–${o.high.toFixed(1)} minutes). Positioned at the model's release date, not the evaluation date. This is not measured human effort reduction or production autonomy.`,
        sources: [
          {
            publisher: "METR",
            title: "Software-task time horizons · v1.1 data",
            url: AGE_AI_SOURCE,
            accessed_at: AGE_AI_AS_OF,
          },
        ],
      });
    }
    audit(db, "database", "age-of-ai-v3", "seed", AGE_AI_SCENARIO);
    db.prepare("INSERT INTO seed_log(id) VALUES('age-of-ai-v3')").run();
  })();
}
