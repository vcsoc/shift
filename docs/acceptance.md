# Acceptance evidence

Executed locally on 14 October 2026, Node 26.7.0, Chromium via Playwright, with isolated real SQLite databases. This report distinguishes implemented/tested functionality from full specification compliance.

## Executed results

- `npm test`: **23/23 passed** across model, React component and SQLite/Fastify integration suites.
- `npm run test:e2e`: **23/23 passed** against the actual production build/server and real Vite proxy; full run 38.5 seconds including startup.
- `npx playwright test tests/e2e/annotations.spec.ts --browser=firefox`: **6/6 passed**, including backup creation through Vite and the unified event/curve workflow.
- Production build (`tsc --noEmit && vite build`): passed, including the build performed before the browser suite.
- Development smoke: `npm run dev` served the Vite frontend on 127.0.0.1:5173 and returned `{"ok":true}` from the API on 127.0.0.1:3001.
- `npm audit`: zero known vulnerabilities in the resolved dependency tree.
- Screenshots below are real browser output, not mockups.

Vite prints harmless Rollup comment-annotation warnings from Zod during build. They do not prevent compilation. Initial browser runs failed until Chromium was installed; subsequent tests found scroll quantization and empty-POST issues, which were fixed before the passing runs.

## UI annotation batch

All eight annotations are implemented and exercised. See [the item-by-item report](ui-annotations.md), including the reproduced Vite/Origin backup failure and fix, bottom-right layout, playback speed measurement, accessible icon tooltip, tabbed form, pencils and atomic event/curve coexistence. Original scaffold anchors remain accessible without data loss. Source histories and scenario estimates are not overwritten by the migration.

## Scenario and military enhancement coverage

Additional tests verify Exponential after Accelerated, URL/seek persistence, independently editable third-scenario forecasts, all four human-role cessation hypotheses and their uncertainty text, bounded curves with identical history, military filtering of both past/future markers and navigation inputs, mobile control bounds, version-1 JSON imports, and upgrading an existing database without overwriting prior estimates or reseeding deleted enhancement points. The research and subjective formula assumptions are recorded in [the scenario analysis](exponential-scenario.md). The separate AI/company-catalog expansion request is pending clarification of default toggle state and catalog scope; it is not claimed complete.

New browser screenshots: [Exponential human-role hypotheses](screenshots/exponential-human-backstops.png), [mobile](screenshots/exponential-mobile.png), [military included](screenshots/military-included.png).

## Mandatory criteria coverage

| # | Criterion | Evidence / remaining qualification |
|---|---|---|
| 1 | Initial 1900, paths, axes, no console errors | Browser assertions plus React path tests; start-point drawing is intentionally minimal at 1900. |
| 2 | Fullscreen target sizes | Exact SVG bounding boxes at 1920×1080, 1366×768 and 390×844; committed screenshots. |
| 3 | Forward/reverse scroll | Real browser wheel assertions; both paths use the same reached-date clip. |
| 4 | Bidirectional synchronized seek | Browser seeks, subsequent scroll, exact-day marker test. Programmatic scroll preserves exact dates despite pixel rounding. |
| 5 | Play/Pause/Prev/Next/end | Browser control test verifies pause and stopping at 2100; elapsed-time RAF playback. |
| 6 | Source-date marker reveal | Transformer paper marker absent on June 11, present on June 12, 2017; year/month anchors explicitly labelled. Complete requested historical checklist remains incomplete. |
| 7 | Transparent sourced overlay | Computed CSS background/border assertions and arXiv link assertion. |
| 8 | Form addition and persistence | Browser creates an event, observes its marker and reloads; integration suite reopens SQLite. |
| 9 | Editing/archive/restore/delete | Browser status lifecycle plus independent forecast-date form edits; transactional API event edits. |
| 10 | Independent editable curve points | Browser add, unsaved preview, value edit and reload; SQLite reopen test; protected boundary-anchor tests. |
| 11 | Scenarios only alter future | Shared anchors compared across real API responses; browser future path changes, June 2027/2033 workflow example, independent edit and “not forecast” persistence. |
| 12 | Computed crossover / none valid | Model tests assert numerical segment intersection and no-crossing result; browser checks reached annotation. No forced intersection. |
| 13 | Useful invalid-input errors | Calendar-date, URL, source, value, cutoff and duplicate-date tests; browser field-keyed validation summary. Adjacent inline errors for all nested fields remain incomplete. |
| 14 | Export/import/backup/restore | Real SQLite API transaction/integrity tests and browser export download, preview, commit, backup and confirmed restore. |
| 15 | Keyboard/touch/reduced-motion/themes | Chromium keyboard test, touch swipe/tap emulation, reduced-motion media emulation and mobile light-theme screenshot. Physical devices and assistive technology not verified. |
| 16 | Malformed API never blanks page | Browser intercepts malformed timeline, observes alert/Retry, then recovers to real server data. Render error boundary exists; deliberate component-crash injection not tested. |
| 17 | Actual server/browser, no uncaught JS | Playwright launches production Fastify, static assets and SQLite; timeline/touch tests assert runtime-error absence. No mocks for normal timeline/admin operation. |

## Actual browser screenshots

- [1920×1080 at 1900](screenshots/timeline-1920x1080.png)
- [1366×768 at 1900](screenshots/timeline-1366x768.png)
- [390×844 at 1900](screenshots/timeline-390x844.png)
- [Complete baseline curves](screenshots/baseline-complete-1920x1080.png)
- [Accelerated / mobile / light](screenshots/accelerated-mobile-light.png)
- [Curve administration](screenshots/curve-editor-1920x1080.png)

## Not yet accepted as complete

The application is usable locally and the executed suites pass, but the specification's full Definition of Done is **not certified**. Outstanding work includes the historical checklist/2026 source research, admin UI pagination beyond 500 records, per-field inline errors, scenario-metadata UI, exhaustive same-date/resize selection and failure-injection coverage, and physical-device/screen-reader review and broader cross-browser coverage beyond the six Firefox annotation regressions. See [README](../README.md#known-limitations--incomplete-specification-details) for precise feature and data limitations.
