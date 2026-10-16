# Age of AI

A fourth scenario, shareable as `?scenario=age-of-ai`. **All historical lines and events from 1900 remain visible. Only 2023–today evidence determines the forecast growth rate.** No pre-2023 observations, historical index slopes, event counts, or other scenarios' growth assumptions enter that fit.

## Evidence snapshot

As-of / retrieval date: **16 October 2026**. This is a frozen, reviewable snapshot, not a live data feed. Advancing the as-of date requires reviewing the source and updating the snapshot, validation boundaries and seed version together.

Source: [METR software-task time horizons](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/), specifically the page's embedded **`benchmarkDataV1_1` / METR-Horizon-v1.1** dataset, not its older v1.0 results. [Analysis repository](https://github.com/METR/eval-analysis-public).

`packages/shared/src/age-ai-data.ts` stores 15 successive record-setting p50 horizon estimates, their source-reported intervals, and model release dates from **14 March 2023 to 7 April 2026**. Starting with the 2023 sample, sort by release date and retain estimates exceeding the previous maximum. Release dates position evaluations of those models; they are not the dates on which measurements were collected. The latest published observation in this snapshot is April 2026: **there is no measured result for October 2026**, and the gap to today is not silently filled with invented observations.

A p50 horizon is the human-time duration of benchmark software tasks at which fitted AI success is **50%**. It is not AI runtime, a production reliability threshold, economy-wide technology progress, or measured human labour saved. Frontier observations are selected, correlated estimates with broad uncertainty; the fit is descriptive, not causal or an independently validated forecasting model. Other advances in the timeline, such as robotics and multimodality, provide context but are not merged into a spurious common numerical metric.

## Reproducible calculation

Implementation: `packages/shared/src/age-ai.ts`.

1. Keep only positive finite observations dated from 1 January 2023 through the as-of date.
2. Fit ordinary least squares: `ln(horizon_minutes) = intercept + slope * days_since_2023_01_01`.
3. The current snapshot gives **124.7656-day doubling** (`ln(2) / slope`). Unlike Exponential, a seven-month doubling period is **not** assumed.
4. Continue the fitted capability ratio conditionally beyond today. Translate it to illustrative indices using explicit, subjective adoption assumptions:

```text
C(t) = exp(slope * days_after_as_of)       # H(t) / H(today)
A(t) = C(t)^0.45 - 1
T(t) = 100 - (100 - T0) / (1 + 0.16*A(t))
floor = min(25, H0)
H(t) = floor + (H0 - floor) / (1 + 0.12*A(t))
```

`T0` and `H0` are the latest shared historical index levels (43 and 89 in the seed). They supply the **starting position**, not the fitted growth rate. Shared historical geometry stays identical in all four scenarios. The original shared history ends on 13 October 2026; the three-day gap to the Age of AI as-of date holds those last levels rather than inventing history. The forecast begins at exactly those values, without a value jump. Its slope need not match the manually chosen historical slope: the forecast boundary is a change in assumptions, not evidence of a sudden breakthrough.

Monthly forecast points through 2040 and annual points thereafter approximate these bounded functions through 2100 using the same piecewise-linear renderer. Indices are arbitrary, not percentages or measured equivalent quantities. The **0.45, 0.16, 0.12 and 25-point floor are not fitted coefficients**. The human floor preserves an illustrative continuing role; it is not a numerical measurement of legal or moral responsibility.

## Human work and responsibility

The cyan future curve is a **hypothetical reduction in routine operational effort**, not an observed 2023–2026 decline in human effort or responsibilities. A comparable longitudinal, society-wide dataset is not supplied. Human accountability, governance, auditing and escalation remain required in this scenario. The [METR developer study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) found a 19% slowdown in its early-2025 experienced-developer setting, illustrating why capability gains cannot simply be treated as labour savings.

Existing sector forecasts and human-role cessation events default to **not forecast** in Age of AI. Benchmark extrapolation does not establish their dates. Administrators may explicitly add their own scenario estimates and values, with rationales. Editing scaffold points changes the displayed scenario but does not refit the evidence snapshot.

## Forecast explanation markers

Five Age-of-AI-only future markers are visible as the playhead reaches **2027, 2028, 2030, 2035 and 2040**. Click them to see the fitted evidence, potential shift from execution to verification, adoption/reliability constraints, continuing human responsibility, and long-run uncertainty. Each links to the METR capability source, the developer-study counterevidence and NIST governance context.

These are **projection checkpoints**, not predicted product launches, observed workforce impacts, or dates at which human roles end. Their descriptions, rationales and assumptions explicitly separate benchmark evidence from subjective mappings. They use automatic curve coordinates, so adding the explanations does not reshape the trajectory. They do not appear on the other three scenario timelines and remain editable, archivable and soft-deletable without reseeding resurrection.

## UI, persistence and compatibility

- Baseline, Accelerated, Exponential and Age of AI each have a methodology tooltip available by hover, focus or tap, associated with their button for assistive technology and dismissible with Escape.
- Full 1900–2100 scrolling, seeking, playback and historical markers remain available in Age of AI. Its forecast boundary is its own as-of date.
- Migration 005 preserves existing records while allowing the fourth scenario's event-owned curve values and forecast origin.
- The durable Age of AI seed adds only its new content and does not overwrite existing three-scenario edits. Repeated startup does not resurrect deleted points.
- JSON exports now use **schema version 4**. Imports of versions 1–3 retain old data and add the new scenario/points with no invented event estimates. Current exports round-trip scenario-specific values. Migration-3-or-newer SQLite backups remain supported and gain the new scenario when needed.

## Verification

Unit tests cover the regression, exclusion of pre-2023/post-as-of inputs, forecast origin, bounds and monotonicity. SQLite integration tests cover matching history, independent future curves, editable/protected points, idempotent seeding, legacy JSON upgrades, backup upgrades and atomic validation. Browser tests cover pre-2023 visibility, scenario persistence, four-scenario administration and hover/focus/touch tooltip geometry. See the acceptance report for executed counts.
