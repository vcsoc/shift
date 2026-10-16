# Recent AI progress and the Exponential scenario

Research checked against the authoritative pages below on 14 October 2026. This is a scenario construction, not an estimate of a universal law or a claim that institutional responsibility necessarily ends.

## What the evidence does—and does not—show

Before 2020, advances such as AlexNet (2012) and Transformers (2017) established important foundations. The post-2020 sequence includes GPT-3's few-shot research, compute-optimal training, multimodal models, reasoning-focused training and vision-language-action robotics. These are different capabilities, not interchangeable points on one empirical curve. Counting announcements cannot establish an exponential rate.

| Dated evidence | Verified source | Interpretation / limitation |
|---|---|---|
| 23 Jan 2020: language-model scaling laws submitted | https://arxiv.org/abs/2001.08361 | Power-law relationships in language-model loss versus compute/data/parameters; not exponential social progress. |
| 28 May 2020: GPT-3 research submitted | https://arxiv.org/abs/2005.14165 | Few-shot language capabilities; no guarantee of reliable unattended execution. |
| 29 Mar 2022: Chinchilla research submitted | https://arxiv.org/abs/2203.15556 | Balancing tokens and model size improved compute efficiency; progress is not just parameter growth. |
| 15 Mar 2023: GPT-4 report submitted | https://arxiv.org/abs/2303.08774 | Multimodal capability and evaluation results; submission date, not product launch. |
| 25 Oct 2024: GPT-4o system card submitted | https://arxiv.org/abs/2410.21276 | Multimodal evaluations and safety context; submission date, not launch. |
| 22 Jan 2025: DeepSeek-R1 research submitted | https://arxiv.org/abs/2501.12948 | Reinforcement-learning approaches to reasoning; benchmark outcomes are not universal reliability. |
| 19 Mar 2025: METR task-horizon analysis | https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/ | Original analysis estimated about seven-month doubling over roughly six years in human-time task duration at **50% success**. Methodological scope and later revisions matter. |
| 22 Apr 2025: π0.5 robotics research submitted | https://arxiv.org/abs/2504.16054 | Household manipulation generalization experiments; not proof of universal physical autonomy. |
| 10 Jul 2025: METR developer study | https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ | Experienced developers took 19% longer with early-2025 AI tools in this study. This limits blanket claims of productivity acceleration. |

The METR trend extends back before 2020, so it does **not** prove a discontinuous new law beginning in 2020. The new scenario asks what happens **if** comparable task-horizon growth continues. It is intentionally more aggressive than Accelerated, while history remains unchanged.

## Transparent curve construction

Implementation: `packages/shared/src/exponential.ts`. Let `t` be UTC years after the historical cutoff, 13 October 2026. The initial shared indices are `T0` and `H0` (43 and 89 in the original seed).

```text
capability multiplier C = 2 ^ (t / (7/12))
adoption proxy A = C ^ 0.45 - 1
technology T = 100 - (100 - T0) / (1 + 0.16*A)
human effort H = min(5,H0) + (H0-min(5,H0)) / (1 + 0.12*A)
```

Only the seven-month task-horizon input comes from the original METR analysis. The **0.45 attenuation, 0.16/0.12 mappings and effort floor are subjective scenario choices**, not measured coefficients or a statistical fit. Quarterly future anchors through 2040, plus longer-run anchors, approximate these bounded functions using the application's piecewise-linear interpolation. Values stay within 0–100; curves join shared history at the cutoff. Every generated point can be edited independently afterwards. A crossover still has no intrinsic interpretation as an automation percentage.

Event estimates are chosen independently per event. They are **not derived from the curve crossing**, and legal or institutional milestones are not inferred from a benchmark doubling time.

## Human-role cessation hypotheses

The new events explicitly model an end to the requirement for a **human** in each role in selected low-risk digital workflows—not just less routine supervision. Non-human assurance or responsibility mechanisms are assumed to replace the role. This is not a statement that responsibility vanishes, not a blanket forecast for society, and not an authorization to remove current safeguards. Dates are editable, low-confidence illustrative windows; **any of these events may never happen**.

| Human requirement assumed to end | Baseline window | Accelerated window | Exponential window |
|---|---|---|---|
| Escalation | 2045–2060 | 2036–2048 | 2031–2040 |
| Auditing | 2050–2070 | 2040–2055 | 2034–2045 |
| Governance | 2065–2090 | 2048–2070 | 2038–2055 |
| Accountability | 2075–2100 | 2055–2080 | 2042–2065 |
| All four in the same bounded scope | 2080–2100 | 2060–2090 | 2045–2070 |

These windows are author-selected hypothetical scenarios, **not expert forecasts or confidence intervals**. Capability alone cannot determine when a jurisdiction will accept non-human accountability or governance. NIST's [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework) supplies current governance context, not evidence for cessation dates. Existing near-term forecasts retain human responsibility until the separately modelled long-run hypotheses.

## Military filter

The **Military On/Off** control defaults off and persists as `?military=0|1`. It includes/excludes defence-related historical and speculative future events from markers, overlays, coincident-event choices and Previous/Next navigation. It never changes the curves or deletes data. Event administration includes a military checkbox; JSON exports retain it.

Added sourced history covers Navy-backed Whirlwind (1946), Minuteman guidance computing (1961), the NTDS sea tests (October 1961) and Predator service (1995). Sources are the Computer History Museum's [1946](https://www.computerhistory.org/timeline/1946/), [1961](https://www.computerhistory.org/timeline/1961/) and [1995](https://www.computerhistory.org/timeline/1995/) chronologies. Existing ENIAC, SAGE and ARPANET records are also tagged for military/defence relevance, including dual-use research. This tag indicates relevance, not exclusively military use.

Future military records are explicitly speculative **noncombat** logistics and depot inspections, with human command accountability retained. The human-role cessation hypotheses do not assert an end to human responsibility for military operations.

## Upgrade and compatibility

Migration 003 adds the event flag. A durable enhancement ledger adds the new scenario/content once to existing installations, without replacing edited Baseline/Accelerated dates, changing shared history, or resurrecting subsequently deleted enhancement points. New unknown/custom forecasts receive “not forecast” for the third scenario rather than invented dates.

Exports now use schema version 3, including the unified event-owned curve values added in [the UI annotation batch](ui-annotations.md). Version 2 remains importable. Legacy version-1 JSON imports are upgraded to three scenarios; historical and old future data are preserved, generated Exponential points are added, and imported events are **not forecast** in Exponential until edited. SQLite backups from migration 3 or later are supported, including those without event-owned curve values (treated as automatic). Earlier SQLite layouts are rejected with an explanation; export JSON using the old app and import it here instead. Current-schema backups continue to restore transactionally.
