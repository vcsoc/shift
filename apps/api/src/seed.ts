import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DB, openDatabase, saveEvent, savePoint } from "./db";
import {
  Scenario,
  SCENARIOS,
  SCENARIO_LABELS,
} from "../../../packages/shared/src/model";
import { EXPONENTIAL_DATES } from "../../../packages/shared/src/exponential";
import { seedEnhancements } from "./enhancements";
function seedInitial(db: DB) {
  if (db.prepare("SELECT id FROM seed_log WHERE id=?").get("initial-v1"))
    return;
  db.transaction(() => {
    for (const id of SCENARIOS)
      db.prepare(
        "INSERT OR IGNORE INTO scenarios(id,name,description,assumptions,is_default) VALUES(?,?,?,?,?)",
      ).run(
        id,
        SCENARIO_LABELS[id],
        "Illustrative editable scenario, not a validated prediction",
        "Human accountability, governance, escalation and auditing continue in near-term workflows; separate long-run cessation hypotheses require institutional change and may never occur.",
        id === "baseline" ? 1 : 0,
      );
    for (const [id, name] of [
      ["computing", "Computing & networks"],
      ["ai", "Artificial intelligence"],
      ["robotics", "Robotics & industry"],
      ["society", "Society, transport & medicine"],
    ])
      db.prepare("INSERT OR IGNORE INTO categories(id,name) VALUES(?,?)").run(
        id,
        name,
      );
    const history = JSON.parse(
      readFileSync("database/seeds/history.json", "utf8"),
    ) as {
      title: string;
      date: string;
      precision: "day" | "month" | "year";
      url: string;
      publisher: string;
      summary: string;
    }[];
    for (const h of history) {
      const id = "history-" + h.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (db.prepare("SELECT id FROM events WHERE id=?").get(id)) continue;
      const cat = /robot|unimate|assembly/i.test(h.title)
        ? "robotics"
        : /gpt|attention|alexnet|dendral|alphago|artificial intelligence|deepseek/i.test(
              h.title,
            )
          ? "ai"
          : Number(h.date.slice(0, 4)) < 1930
            ? "society"
            : "computing";
      saveEvent(db, {
        id,
        title: h.title,
        kind: "verified_history",
        date_precision: h.precision,
        historical_date_start: h.date,
        category_id: cat,
        summary: h.summary,
        impact:
          "Interpretation: this milestone expanded technical capabilities; effects on society varied by context.",
        technology_type: cat === "ai" ? "AI" : "other",
        status: "published",
        sources: [
          {
            publisher: h.publisher,
            title: h.title,
            url: h.url,
            accessed_at: "2026-10-14",
          },
        ],
      });
    }
    const forecasts = [
      ["Bounded digital workflows", "2033-06-30", "2027-06-30", "ai"],
      ["Bounded software maintenance", "2036-01-01", "2029-01-01", "ai"],
      ["Customer service workflows", "2034-01-01", "2028-01-01", "ai"],
      ["Warehouse robotics", "2040-01-01", "2032-01-01", "robotics"],
      ["Industrial inspection", "2038-01-01", "2030-01-01", "robotics"],
      ["Autonomous logistics", "2045-01-01", "2037-01-01", "robotics"],
      ["Agricultural robotics", "2048-01-01", "2039-01-01", "robotics"],
      ["Construction robotics", "2055-01-01", "2044-01-01", "robotics"],
      ["Clinical administration", "2039-01-01", "2031-01-01", "ai"],
      ["Infrastructure orchestration", "2050-01-01", "2040-01-01", "ai"],
    ];
    for (const [
      i,
      [title, baseline, accelerated, cat],
    ] of forecasts.entries()) {
      const id = "forecast-" + i;
      if (db.prepare("SELECT id FROM events WHERE id=?").get(id)) continue;
      const description =
        "Routine human oversight may no longer be required for some bounded, reliable, permissioned workflows. Human accountability, governance, escalation and auditing continue.";
      const f = (date: string) => ({
        estimated_start: date,
        estimated_end: null,
        description,
        rationale:
          "Editable illustrative assumption about reliability and adoption in this specific sector.",
        assumptions:
          "Permissioned deployment, rigorous monitoring and human escalation remain necessary.",
        confidence: "low",
      });
      saveEvent(db, {
        id,
        title:
          i === 0
            ? "Routine human oversight no longer required for some bounded digital workflows"
            : title,
        kind: "future_forecast",
        date_precision: i === 0 ? "day" : "year",
        historical_date_start: null,
        category_id: cat,
        summary: description,
        status: "published",
        technology_type: cat === "ai" ? "AI" : "AI+robotics",
        sources: [],
        forecasts: {
          baseline: f(baseline),
          accelerated: f(accelerated),
          exponential: f(EXPONENTIAL_DATES[i]),
        },
      });
    }
    const shared = [
      [1900, 3, 98],
      [1940, 8, 96],
      [1980, 17, 94],
      [2000, 25, 92],
      [2026, 43, 89],
    ];
    const future = {
      baseline: [
        [2035, 51, 86],
        [2045, 64, 82],
        [2055, 77, 77],
        [2070, 93, 60],
        [2100, 99, 32],
      ],
      accelerated: [
        [2027, 48, 88],
        [2032, 62, 84],
        [2040, 80, 75],
        [2055, 94, 56],
        [2100, 99, 25],
      ],
    };
    for (const [scenario, anchors] of [
      [null, shared],
      ...Object.entries(future),
    ] as [Scenario | null, number[][]][]) {
      for (const [year, tech, human] of anchors) {
        const id = `point-${scenario || "shared"}-${year}`;
        if (db.prepare("SELECT id FROM curve_points WHERE id=?").get(id))
          continue;
        savePoint(db, {
          id,
          scenario_id: scenario,
          point_date:
            year === 2100
              ? "2100-12-31"
              : year === 2026
                ? "2026-10-13"
                : `${year}-01-01`,
          technology_index: tech,
          human_effort_index: human,
          rationale:
            "Illustrative conceptual anchor; not an empirical measurement.",
        });
      }
    }
    db.prepare("INSERT INTO seed_log(id) VALUES(?)").run("initial-v1");
  })();
}
export function seed(db: DB) {
  seedInitial(db);
  seedEnhancements(db);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = openDatabase();
  seed(db);
  db.close();
  console.log("Seed complete (existing records unchanged).");
}
