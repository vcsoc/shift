import { useState } from "react";
import {
  Scenario,
  SCENARIOS,
  SCENARIO_LABELS,
} from "../../../../packages/shared/src/model";
import {
  AGE_AI_AS_OF,
  AGE_AI_FIT,
} from "../../../../packages/shared/src/age-ai";
export const SCENARIO_METHODS: Record<Scenario, string> = {
  baseline:
    "Baseline: shared illustrative historical anchors through 13 October 2026, followed by manually chosen, slower-adoption technology and human-effort anchors. Straight-line interpolation between points; sector dates are independent editable assumptions. No statistical fit, measured automation rate or prediction that human responsibility ends.",
  accelerated:
    "Accelerated: the same shared historical anchors as Baseline, with manually chosen future anchors and earlier sector estimates to explore faster adoption and reliability gains. Bounded piecewise-linear interpolation, not a fitted growth law. Human accountability and governance continue unless a separately labelled hypothetical institutional change is assumed.",
  exponential:
    "Exponential: shared history through 13 October 2026, then a conditional continuation of METR's March 2025 approximately seven-month AI task-horizon doubling. Subjective 0.45 adoption attenuation and 0.16 technology / 0.12 effort mappings create bounded curves with a five-point human-effort floor. Quarterly future anchors approximate the formula; event and human-role cessation dates are independent low-confidence hypotheses, not benchmark-derived predictions.",
  "age-of-ai": `Age of AI: full shared history remains visible, but only 2023–${AGE_AI_AS_OF} evidence determines the forecast growth rate. Log-linear regression of ${AGE_AI_FIT.count} record-setting METR-Horizon-v1.1 software-task results at 50% success gives approximately ${Math.round(AGE_AI_FIT.doublingDays)}-day doubling. The forecast starts from the latest shared index levels, with subjective 0.45 adoption attenuation, 0.16 technology / 0.12 effort mappings and a 25-point human-effort floor. These do not measure society-wide work or declining responsibility. Latest observation: April 2026; the gap to today and the future are unobserved. No human-role end dates are inferred.`,
};
export function ForecastScenarios({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
}) {
  const [open, setOpen] = useState<Scenario | null>(null);
  return (
    <div
      className="segmented"
      aria-label="Forecast scenario"
      onMouseLeave={() => setOpen(null)}
    >
      {SCENARIOS.map((s) => (
        <button
          key={s}
          className="forecast-option"
          aria-label={SCENARIO_LABELS[s]}
          aria-pressed={scenario === s}
          aria-describedby={`method-${s}`}
          onMouseEnter={() => setOpen(s)}
          onFocus={() => setOpen(s)}
          onBlur={() => setOpen(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(null);
              e.stopPropagation();
            }
          }}
          onClick={() => {
            onChange(s);
            setOpen(s);
          }}
        >
          <span className="forecast-label-text">{SCENARIO_LABELS[s]}</span>
          <span
            id={`method-${s}`}
            role="tooltip"
            className="control-tooltip scenario-tooltip"
            hidden={open !== s}
          >
            {SCENARIO_METHODS[s]}
          </span>
        </button>
      ))}
    </div>
  );
}
