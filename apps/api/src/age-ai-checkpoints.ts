import { DB, audit, saveEvent } from "./db";
import {
  AGE_AI_AS_OF,
  AGE_AI_SOURCE,
  AGE_AI_FIT,
  AGE_AI_ASSUMPTIONS,
} from "../../../packages/shared/src/age-ai";
import { SCENARIOS } from "../../../packages/shared/src/model";
export const AGE_AI_CHECKPOINTS = [
  {
    year: 2027,
    title: "Age of AI: the recent capability trend continues (conditional)",
    description:
      "Projection checkpoint, not a predicted breakthrough. The orange trajectory continues the growth rate fitted to 15 record-setting METR software-task results from March 2023 to April 2026, reviewed in October 2026. It begins at the existing historical index levels, without using pre-2023 evidence to fit the rate. No measured October result is invented.",
    rationale:
      "The regression fits log(task-horizon minutes) against release dates. A 50% benchmark success horizon measures a narrow software capability, not reliable deployment or human replacement.",
  },
  {
    year: 2028,
    title: "Age of AI: less routine execution, more verification (assumption)",
    description:
      "Projection checkpoint. If capability gains translate into usable tools, people could spend less time on routine execution and more on checking outputs, resolving exceptions and directing work. This is the assumed meaning of the cyan decline, not an observed workforce trend or an assertion that these changes occur in 2028.",
    rationale:
      "The 0.45 adoption attenuation deliberately slows the benchmark growth before applying the subjective 0.16 technology and 0.12 effort mappings. These coefficients are assumptions, not productivity measurements. METR's early-2025 developer study found a slowdown in its setting.",
  },
  {
    year: 2030,
    title: "Age of AI: adoption and reliability constrain the impact",
    description:
      "Projection checkpoint. The curves explore increasing technical reliance and lower routine effort only if organisations can deploy and integrate the tools safely. Cost, reliability, robotics, permissions, institutions and demand can delay or prevent those impacts. A crossing compares arbitrary indices; it does not establish an automation percentage or an end to human roles.",
    rationale:
      "Recent software-task gains are extrapolated conditionally, not merged with incomparable robotics announcements. The long-run bounds are imposed by the model; they are not evidence of economy-wide saturation or measured employment losses.",
  },
  {
    year: 2035,
    title: "Age of AI: routine effort falls, human responsibility remains",
    description:
      "Projection checkpoint. The cyan curve approaches a 25-point illustrative floor rather than zero. People remain accountable for governance, auditing, escalation and decisions even when routine execution is assumed to need less intervention. The floor is not a measured share of responsibility, and benchmark growth cannot establish legal or institutional role-cessation dates.",
    rationale:
      "The human-effort floor and slower response are explicit scenario choices. NIST's AI Risk Management Framework provides governance context, not support for a particular future reduction in effort.",
  },
  {
    year: 2040,
    title: "Age of AI: the long-run extrapolation is highly uncertain",
    description:
      "Projection checkpoint. Extending a short 2023–2026 capability trend this far is an aggressive what-if, not a validated prediction. Growth may slow or stall; benchmark validity, resource constraints and adoption can change. Technology tending toward 100 and effort toward 25 are mathematical limits chosen for this graph, not observed destinations for humanity.",
    rationale:
      "Only the recent capability growth rate is fitted. No independent evidence validates decades of continued growth, the adoption coefficients or a society-wide decline in work. Checkpoints explain the trajectory; their calendar positions are not forecasts of specific product launches or social transitions.",
  },
] as const;
export function seedAgeAICheckpoints(db: DB) {
  if (
    db
      .prepare("SELECT id FROM seed_log WHERE id='age-of-ai-checkpoints-v1'")
      .get()
  )
    return;
  db.transaction(() => {
    for (const checkpoint of AGE_AI_CHECKPOINTS) {
      const id = `age-ai-projection-${checkpoint.year}`;
      if (db.prepare("SELECT id FROM events WHERE id=?").get(id)) continue;
      const forecasts = Object.fromEntries(
        SCENARIOS.map((scenario) => [
          scenario,
          {
            estimated_start:
              scenario === "age-of-ai" ? `${checkpoint.year}-01-01` : null,
            estimated_end: null,
            description:
              scenario === "age-of-ai"
                ? checkpoint.description
                : "Age of AI explanation checkpoint; not forecast in this scenario.",
            rationale:
              scenario === "age-of-ai"
                ? `${checkpoint.rationale} Recent fitted doubling: ${AGE_AI_FIT.doublingDays.toFixed(1)} days.`
                : "This explanation belongs only to the Age of AI trajectory.",
            assumptions: AGE_AI_ASSUMPTIONS,
            confidence: "low",
          },
        ]),
      );
      saveEvent(db, {
        id,
        title: checkpoint.title,
        kind: "future_forecast",
        date_precision: "year",
        historical_date_start: null,
        category_id: "ai",
        technology_type: "AI",
        status: "published",
        summary: checkpoint.description,
        forecasts,
        sources: [
          {
            publisher: "METR",
            title:
              "Benchmark growth input, not support for workforce forecasts",
            url: AGE_AI_SOURCE,
            accessed_at: AGE_AI_AS_OF,
          },
          {
            publisher: "METR developer study",
            title: "Counterevidence: a context-specific 19% slowdown",
            url: "https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/",
            accessed_at: AGE_AI_AS_OF,
          },
          {
            publisher: "NIST",
            title:
              "AI Risk Management Framework: governance context, not forecast dates",
            url: "https://www.nist.gov/itl/ai-risk-management-framework",
            accessed_at: AGE_AI_AS_OF,
          },
        ],
      });
    }
    audit(db, "database", "age-of-ai-checkpoints-v1", "seed", {
      checkpoints: AGE_AI_CHECKPOINTS.length,
    });
    db.prepare(
      "INSERT INTO seed_log(id) VALUES('age-of-ai-checkpoints-v1')",
    ).run();
  })();
}
