import { DB, audit, saveEvent, savePoint } from "./db";
import {
  CUTOFF,
  SCENARIOS,
  SCENARIO_LABELS,
  forecastSchema,
} from "../../../packages/shared/src/model";
import {
  exponentialPoints,
  EXPONENTIAL_DATES,
} from "../../../packages/shared/src/exponential";
import { z } from "zod";
type Forecast = z.infer<typeof forecastSchema>;
export const RESEARCH_HISTORY = [
  {
    id: "ai-scaling-2020",
    title: "Language-model scaling laws research submitted",
    date: "2020-01-23",
    category: "ai",
    publisher: "OpenAI / arXiv",
    url: "https://arxiv.org/abs/2001.08361",
    summary:
      "Researchers measured power-law relationships between language-model loss, compute, data and model size. A power law in loss is not evidence that all social outcomes improve exponentially.",
  },
  {
    id: "ai-chinchilla-2022",
    title: "Compute-optimal language-model training research submitted",
    date: "2022-03-29",
    category: "ai",
    publisher: "DeepMind / arXiv",
    url: "https://arxiv.org/abs/2203.15556",
    summary:
      "Chinchilla research showed how balancing training tokens and parameter count improves compute efficiency. Capability progress depends on data and training choices, not simply larger models.",
  },
  {
    id: "ai-metr-horizon-2025",
    title: "METR reports exponential growth in AI task horizons",
    date: "2025-03-19",
    category: "ai",
    publisher: "METR",
    url: "https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/",
    summary:
      "In its March 2025 analysis, METR estimated roughly seven-month doubling of the human-time duration of tasks agents complete with 50% reliability over about six years. This is a benchmark-specific trend, not guaranteed production reliability or an end to human governance.",
  },
  {
    id: "ai-metr-limit-2025",
    title: "METR developer study finds an important limit to AI acceleration",
    date: "2025-07-10",
    category: "ai",
    publisher: "METR",
    url: "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/",
    summary:
      "A randomized study found experienced open-source developers took 19% longer with early-2025 AI tools on their own repositories. This context-specific result cautions against treating benchmark gains as universal productivity gains.",
  },
  {
    id: "military-whirlwind-1946",
    title: "Navy-backed Project Whirlwind begins",
    date: "1946-01-01",
    precision: "year",
    category: "military",
    publisher: "Computer History Museum",
    url: "https://www.computerhistory.org/timeline/1946/",
    summary:
      "A US Navy flight-simulator project moved toward digital computing at MIT, contributing to real-time computing and magnetic-core memory. This event illustrates military and civilian technology links.",
  },
  {
    id: "military-minuteman-1961",
    title: "Minuteman I guidance computer developed",
    date: "1961-01-01",
    precision: "year",
    category: "military",
    publisher: "Computer History Museum",
    url: "https://www.computerhistory.org/timeline/1961/",
    summary:
      "Transistorized guidance computing illustrated the military demand for compact, reliable electronics and influenced semiconductor quality control.",
  },
  {
    id: "military-ntds-1961",
    title: "Naval Tactical Data System tested at sea",
    date: "1961-10-01",
    precision: "month",
    category: "military",
    publisher: "Computer History Museum",
    url: "https://www.computerhistory.org/timeline/1961/",
    summary:
      "The US Navy tested a computer-based system integrating radar, sonar and communications information in October 1961, advancing real-time military information processing.",
  },
  {
    id: "military-predator-1995",
    title: "MQ-1 Predator enters service",
    date: "1995-01-01",
    precision: "year",
    category: "military",
    publisher: "Computer History Museum",
    url: "https://www.computerhistory.org/timeline/1995/",
    summary:
      "The remotely operated Predator entered military service, illustrating the expanding role of unmanned aircraft. Remote operation is not the same as autonomous decision-making.",
  },
] as const;
const END_ASSUMPTIONS =
  "Speculative institutional as well as technical change: a jurisdiction explicitly accepts non-human responsibility mechanisms and waives the specified human role for selected low-risk digital workflows. Not a claim about all society, military operations, or present legal obligations. The date may never occur.";
export const NEW_FORECASTS = [
  {
    id: "future-human-escalation-ends",
    title:
      "Human escalation no longer required in bounded digital workflows (hypothesis)",
    military: false,
    dates: ["2045-01-01", "2036-01-01", "2031-01-01"],
    ends: ["2060-01-01", "2048-01-01", "2040-01-01"],
    description:
      "In this speculative scenario, selected low-risk digital workflows resolve exceptions without escalating to a human. This is a proposed end to the human escalation requirement within that scope, not merely reduced routine oversight.",
  },
  {
    id: "future-human-auditing-ends",
    title:
      "Human auditing no longer required in bounded digital workflows (hypothesis)",
    military: false,
    dates: ["2050-01-01", "2040-01-01", "2034-01-01"],
    ends: ["2070-01-01", "2055-01-01", "2045-01-01"],
    description:
      "In this speculative scenario, independent machine audit mechanisms replace required human auditing for selected low-risk digital workflows. Auditing itself continues; its human staffing requirement is assumed to end.",
  },
  {
    id: "future-human-governance-ends",
    title:
      "Human governance no longer required in bounded digital workflows (hypothesis)",
    military: false,
    dates: ["2065-01-01", "2048-01-01", "2038-01-01"],
    ends: ["2090-01-01", "2070-01-01", "2055-01-01"],
    description:
      "In this speculative scenario, institutions accept non-human governance for selected low-risk digital workflows, ending the requirement for a human decision-maker in that scope. Technical autonomy alone cannot establish that this change is justified.",
  },
  {
    id: "future-human-accountability-ends",
    title:
      "Human accountability no longer required in bounded digital workflows (hypothesis)",
    military: false,
    dates: ["2075-01-01", "2055-01-01", "2042-01-01"],
    ends: ["2100-01-01", "2080-01-01", "2065-01-01"],
    description:
      "In this speculative scenario, law and institutions assign accountability to non-human mechanisms for selected low-risk digital workflows, ending the requirement for a human accountable party in that scope. This is not a prediction that responsibility disappears or a statement of current law.",
  },
  {
    id: "future-four-backstops-end",
    title:
      "All four human backstops no longer required in bounded workflows (hypothesis)",
    military: false,
    dates: ["2080-01-01", "2060-01-01", "2045-01-01"],
    ends: ["2100-12-31", "2090-01-01", "2070-01-01"],
    description:
      "This optional long-run hypothesis combines the end of required human accountability, governance, escalation and auditing in selected low-risk digital workflows. Non-human responsibility and assurance mechanisms replace those roles. It is not a forecast for humanity as a whole, and may never happen.",
  },
  {
    id: "military-future-logistics",
    title:
      "AI-led noncombat military logistics planning (illustrative estimate)",
    military: true,
    dates: ["2038-01-01", "2032-01-01", "2029-01-01"],
    ends: ["2048-01-01", "2040-01-01", "2035-01-01"],
    description:
      "Illustrative adoption window for AI-led scheduling and inventory coordination in noncombat military logistics. Human command accountability and authorization are retained; no claim of autonomous use of force.",
  },
  {
    id: "military-future-inspection",
    title: "Autonomous military depot inspections (illustrative estimate)",
    military: true,
    dates: ["2042-01-01", "2035-01-01", "2030-01-01"],
    ends: ["2052-01-01", "2045-01-01", "2038-01-01"],
    description:
      "Illustrative adoption window for autonomous inspection and maintenance reporting at military depots, with human responsibility for deployment and response. This concerns support functions, not targeting or weapons employment.",
  },
] as const;
export function seedEnhancements(db: DB) {
  if (
    db
      .prepare("SELECT id FROM seed_log WHERE id=?")
      .get("future-military-exponential-v2")
  )
    return;
  db.transaction(() => {
    db.prepare(
      "INSERT OR IGNORE INTO scenarios(id,name,description,assumptions,is_default) VALUES(?,?,?,?,0)",
    ).run(
      "exponential",
      SCENARIO_LABELS.exponential,
      "Speculative continuation of recent AI task-horizon growth, not a validated prediction.",
      "METR March 2025 ~7-month horizon doubling; subjective adoption mapping. Legal and institutional changes are independent assumptions and may never occur.",
    );
    db.prepare(
      "UPDATE scenarios SET description=?,assumptions=? WHERE id='exponential' AND description='Illustrative editable scenario, not a validated prediction'",
    ).run(
      "Speculative continuation of recent AI task-horizon growth, not a validated prediction.",
      "METR March 2025 ~7-month horizon doubling; subjective adoption mapping. Legal and institutional changes are independent assumptions and may never occur.",
    );
    db.prepare("UPDATE scenarios SET assumptions=? WHERE assumptions=?").run(
      "Human accountability, governance, escalation and auditing continue in near-term workflows; separate long-run cessation hypotheses require institutional change and may never occur.",
      "Human accountability, governance, escalation and auditing continue.",
    );
    for (const [id, name] of [
      ["military", "Military & defence"],
      ["governance", "Governance & responsibility"],
    ])
      db.prepare("INSERT OR IGNORE INTO categories(id,name) VALUES(?,?)").run(
        id,
        name,
      );
    // Add only missing third-scenario rows. Never replace an administrator's estimates.
    const existing = db
      .prepare("SELECT id FROM events WHERE kind='future_forecast'")
      .all() as { id: string }[];
    const insert = db.prepare(
      "INSERT OR IGNORE INTO event_forecasts(event_id,scenario_id,estimated_start,estimated_end,description,rationale,assumptions,confidence) VALUES(?,?,?,?,?,?,?,?)",
    );
    for (const { id } of existing) {
      const index = Number(id.replace("forecast-", ""));
      const date = id.startsWith("forecast-")
        ? (EXPONENTIAL_DATES[index] ?? null)
        : null;
      const old = db
        .prepare(
          "SELECT description FROM event_forecasts WHERE event_id=? AND scenario_id='accelerated'",
        )
        .get(id) as { description: string } | undefined;
      insert.run(
        id,
        "exponential",
        date,
        null,
        old?.description || "Not forecast in this scenario.",
        "Illustrative per-event extrapolation, not a validated prediction.",
        "Capability growth continues; adoption, reliability and institutions may delay or prevent this milestone.",
        "low",
      );
    }
    const anchor = db
      .prepare(
        "SELECT technology_index,human_effort_index FROM curve_points WHERE scenario_id IS NULL AND point_date=?",
      )
      .get(CUTOFF) as
      { technology_index: number; human_effort_index: number } | undefined;
    for (const p of exponentialPoints(
      anchor?.technology_index,
      anchor?.human_effort_index,
    ))
      if (
        !db
          .prepare(
            "SELECT id FROM curve_points WHERE scenario_id=? AND point_date=?",
          )
          .get("exponential", p.point_date)
      )
        savePoint(db, p);
    for (const h of RESEARCH_HISTORY) {
      if (db.prepare("SELECT id FROM events WHERE id=?").get(h.id)) continue;
      saveEvent(db, {
        id: h.id,
        title: h.title,
        kind: "verified_history",
        date_precision: "precision" in h ? h.precision : "day",
        historical_date_start: h.date,
        category_id: h.category,
        is_military: h.category === "military",
        summary: h.summary,
        status: "published",
        technology_type: h.category === "ai" ? "AI" : "other",
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
    // Existing explicitly defence-related milestones participate in the same filter.
    for (const id of [
      "history-public-unveiling-of-eniac",
      "history-sage-system-goes-online",
      "history-hooking-up-networks-come-online",
    ]) {
      db.prepare("UPDATE events SET is_military=1 WHERE id=?").run(id);
    }
    for (const item of NEW_FORECASTS) {
      if (db.prepare("SELECT id FROM events WHERE id=?").get(item.id)) continue;
      const forecasts = Object.fromEntries(
        SCENARIOS.filter((s) => s !== "age-of-ai").map((s, i) => [
          s,
          {
            estimated_start: item.dates[i],
            estimated_end: item.ends[i],
            description: item.description,
            rationale: `${SCENARIO_LABELS[s]} scenario assumption, independently chosen for this milestone; the date range is illustrative, not a statistical confidence interval.`,
            assumptions: item.military
              ? "Bounded noncombat deployment, reliability testing and human command responsibility continue."
              : END_ASSUMPTIONS,
            confidence: "low",
          } satisfies Forecast,
        ]),
      );
      saveEvent(db, {
        id: item.id,
        title: item.title,
        kind: "future_forecast",
        date_precision: "range",
        historical_date_start: null,
        category_id: item.military ? "military" : "governance",
        is_military: item.military,
        summary: item.description,
        status: "published",
        technology_type: "AI",
        sources: item.military
          ? []
          : [
              {
                publisher: "NIST",
                title:
                  "AI Risk Management Framework (context, not support for forecast dates)",
                url: "https://www.nist.gov/itl/ai-risk-management-framework",
                accessed_at: "2026-10-14",
              },
            ],
        forecasts,
      });
    }
    audit(db, "database", "enhancements-v2", "seed", {
      history: RESEARCH_HISTORY.length,
      forecasts: NEW_FORECASTS.length,
    });
    db.prepare("INSERT INTO seed_log(id) VALUES(?)").run(
      "future-military-exponential-v2",
    );
  })();
}
