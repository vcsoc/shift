# THE SHIFT — Humanity & Technology Timeline
**AI Agent Implementation Specification | Version 1.0 | 13 October 2026**

## 1. Product objective
Create a local-first, fullscreen interactive graph spanning **1900–2100**, revealing humanity's evolving relationship with technology. Two animated lines progressively draw as the user scrolls forward in time. Dated milestone markers reveal real historical breakthroughs and clearly labelled future scenarios. Admins add/edit milestones and graph points using forms, persisted in **SQLite**. A **Baseline / Accelerated** toggle changes future event timing and future curve geometry, never verified history.

**Critical:** The two curves are *illustrative conceptual indices*, not empirical measurements. A crossing does **not** establish that humans are unnecessary. The interface must clearly distinguish history, current observation, and speculative forecasts.

## 2. Required technology
- **Frontend:** React, TypeScript, Vite, SVG with D3 scales/interpolation, CSS variables.
- **Backend:** Fastify, Node.js, TypeScript.
- **Database:** SQLite (`better-sqlite3`), migrations, transactions, WAL mode.
- **Validation:** Zod shared between client and server.
- **Testing:** Vitest, React Testing Library, Playwright.
- **Deployment:** `npm install`, `npm run dev`, `npm run build`, `npm start`. Bind localhost (`127.0.0.1`) by default. Configure `DATA_DIR`; keep database outside static assets. Do not expose admin writes publicly without authentication.

Recommended structure:
```text
apps/web/src/{components,features,lib,styles}
apps/api/src/{routes,services,db}
packages/shared/src/{types,schemas}
database/{migrations,seeds}
tests/{unit,integration,e2e}
docs/
```

## 3. Fullscreen design
- The graph occupies **100vw × 100dvh**, behind all controls, without dashboard cards, empty margins, or nested graph scrolling.
- Small responsive axis gutters only; resize SVG scales and paths when viewport changes.
- X axis: exact calendar time, 1900–2100. Y axis: conceptual index, 0–100.
- **Orange:** technology integration and dependency in human life and infrastructure.
- **Cyan:** direct human operational effort, coordination, intervention and supervision.
- Human effort remains high through 2026; later declines are scenario assumptions.
- Top-left: compact THE SHIFT wordmark and colour legend.
- Top-right: enormous current year. Immediately below: milestone's date, title, category, concise significance, and source links, **without any background, border, blur, or card**. Plain text with subtle shadow.
- Bottom: slim overlaid transport strip: Play/Pause, Previous/Next event, year seek slider, current year, Baseline/Accelerated toggle, dark/light toggle.
- Historical and future portions visually distinguished; forecast labels remain obvious.
- Render markers only once reached. Click/keyboard activation seeks to exact event date. Cluster same-date markers.
- Support mouse, wheel, trackpad, touch, keyboard, reduced-motion preference and responsive mobile layout.

## 4. Scroll, seek and playback
1. Start at 1900. Pin graph while vertical page scroll advances the date horizontally. Scrolling backwards rewinds.
2. Draw both paths only up to the active date. No unreached markers or future descriptions.
3. Slider changes the active date immediately and synchronizes page scroll to prevent subsequent snapping.
4. Playback advances at configurable speed (default 10 years/second), using `requestAnimationFrame` and elapsed time. Pause resumes without reset. Stop at 2100.
5. Previous/Next jumps to exact dates of visible/published events.
6. Preserve selected date, scenario and event through resize and theme changes.
7. If multiple events are reached, show latest, with a chooser for coincident events.
8. `prefers-reduced-motion` disables decorative transitions, not controls.
9. Never let a JavaScript error silently blank the graph; use error boundary and retry.

## 5. Forecast scenarios
Provide a prominent segmented **Baseline | Accelerated** toggle and URL state `?scenario=baseline|accelerated`.

Historical events and historical curve points are identical in both scenarios. Future events have independently editable estimated dates, rationale, confidence, description and optional date ranges for each scenario. Future curve control points also differ independently. Switching mode updates all future markers, future curve, event details and computed intersection while keeping the current seek date.

**Example forecast: “Routine human oversight no longer required for some bounded digital workflows.”**
- Baseline sample: **30 June 2033**
- Accelerated sample: **30 June 2027**
- Meaning: selected reliable, permissioned tasks might run end-to-end without routine step-by-step supervision, but human accountability, governance, escalation and auditing continue.
- Both dates are **illustrative editable assumptions**, not validated predictions. Never state that all AI stops needing oversight in June 2027.

Seed other editable forecast events for bounded software maintenance, customer service, warehouse robotics, industrial inspection, autonomous logistics, agricultural robotics, construction, clinical administration and infrastructure orchestration. Accelerated dates must be chosen per event; do not use a blanket date multiplier. Allow “not forecast” per scenario.

## 6. Curve data and interpolation
Store **curve control points independently of events**. Each point contains date, technology index 0–100, human effort index 0–100, scenario (null for shared history), and rationale. Forms allow adding, editing and removing points with immediate preview.

Use bounded monotone interpolation (D3 `curveMonotoneX`) or piecewise linear interpolation. Preserve exact date precision. Prevent overshoot beyond 0–100 and discontinuities at historical/forecast boundary. Do not hardcode crossover dates: calculate any intersection numerically from the active scenario and label **“Illustrative index crossover”**. The indices are different constructs; their intersection is not an automation rate.

Initial *illustrative* baseline control points:

| Year | Technology | Human effort |
|---|---:|---:|
| 1900 | 3 | 98 |
| 1940 | 8 | 96 |
| 1980 | 17 | 94 |
| 2000 | 25 | 92 |
| 2026 | 43 | 89 |
| 2035 | 51 | 86 |
| 2045 | 64 | 82 |
| 2055 | 77 | 77 |
| 2070 | 93 | 60 |
| 2100 | 99 | 32 |

Accelerated future anchors should be separately seeded and editable. They may produce an earlier crossover, but do not force one. Provide documentation describing each index's interpretation and limitations.

## 7. Event administration
Add **Manage Events** and **Manage Curve Points** interfaces, accessible from a discreet toolbar button. Use a side panel or `/admin` route with searchable/sortable list and Add, Edit, Duplicate, Archive, Restore, Delete, Preview actions.

Event form fields:
| Field | Required | Rules |
|---|---|---|
| Title | Yes | 1–150 characters |
| Kind | Yes | Verified history, approximate history, observed current, future forecast |
| Date precision | Yes | Exact day, month, year, range |
| Historical date | Historical | ISO date or precision-aware date/range; never invent day |
| Category/subsector | Yes | Managed taxonomy |
| Summary | Yes | 1–1000 chars |
| Impact and significance | Optional | 1–3000 chars |
| Technology type | Optional | AI, AI+robotics, other |
| Sources | Verified events | Repeatable publisher, title, URL, access date |
| Baseline estimate | Forecast | Date/date range or not forecast |
| Accelerated estimate | Forecast | Date/date range or not forecast |
| Scenario descriptions | Forecast | Assumptions, rationale, uncertainty |
| Confidence | Forecast | Low/medium/high |
| Related events | Optional | Enables / influenced-by |
| Visibility | Yes | Draft/published/archived |

Curve point form: date, scenario/shared history, technology value, human effort value, rationale. Validate unique dates per scenario, ordered dates, range 0–100 and at least two points per series. Warn before deleting essential anchors.

Historical dates cannot be scenario-specific. Forecast dates cannot be marked as observed. Show inline validation, unsaved-change warning, success/error notifications, and immediate graph refresh. Soft-delete by default.

## 8. SQLite data model
Implement migrations for:
- `scenarios(id, name, description, assumptions, is_default, created_at, updated_at)`
- `categories(id, name, parent_id)`
- `events(id, title, kind, date_precision, historical_date_start, historical_date_end, category_id, summary, impact, technology_type, status, created_at, updated_at, deleted_at)`
- `event_forecasts(event_id, scenario_id, estimated_start, estimated_end, description, rationale, assumptions, confidence, PRIMARY KEY(event_id, scenario_id))`
- `event_sources(id, event_id, publisher, title, url, accessed_at)`
- `curve_points(id, scenario_id NULL for shared history, point_date, technology_index, human_effort_index, rationale, created_at, updated_at)`
- `event_links(source_event_id, target_event_id, relationship, explanation)`
- `audit_log(id, entity_type, entity_id, action, changed_at, change_json)`

Use foreign keys, indexes, parameterized SQL, transactional writes, and `CHECK` constraints for values 0–100. **SQLite permits multiple NULLs in UNIQUE constraints**: use partial unique indexes for shared historical points (`scenario_id IS NULL`) and scenario points (`scenario_id IS NOT NULL`). Enforce that shared historical points precede the configured historical cutoff and scenario points follow it. Store date precision explicitly.

## 9. API contract
All API responses JSON. All writes validated with Zod and return structured errors with `code`, `message`, `fieldErrors`.

```http
GET    /api/v1/health
GET    /api/v1/timeline?scenario=baseline
GET    /api/v1/events?search=&category=&status=&scenario=
GET    /api/v1/events/:id
POST   /api/v1/events
PATCH  /api/v1/events/:id
DELETE /api/v1/events/:id
POST   /api/v1/events/:id/restore
GET    /api/v1/scenarios
PATCH  /api/v1/scenarios/:id
GET    /api/v1/curve-points?scenario=baseline
POST   /api/v1/curve-points
PATCH  /api/v1/curve-points/:id
DELETE /api/v1/curve-points/:id
GET    /api/v1/categories
POST   /api/v1/categories
GET    /api/v1/export?format=json
POST   /api/v1/import/preview
POST   /api/v1/import/commit
POST   /api/v1/admin/backup
POST   /api/v1/admin/restore
```

`GET /timeline` merges shared historical data with selected scenario's forecast data; frontend never directly queries SQLite. Support pagination for admin lists. Cache reads and invalidate after edits.

## 10. Historical milestones to research and seed
Seed **at least 40 sourced milestones** across 1900–2026, including:
- 1901 transatlantic wireless; 1903 Wright flight; 1913 moving assembly line; electrification; 1928 penicillin.
- 1946 ENIAC; 1947 transistor; 1956 Dartmouth AI workshop; 1957 Sputnik; 1958 integrated circuit.
- 1961 first human spaceflight and industrial robot; 1969 Apollo 11 and ARPANET; 1971 microprocessor; 1973 handheld cellular call.
- 1981 IBM PC; 1983 TCP/IP; 1989 web proposal; 1991 public web announcement; 1997 Deep Blue.
- 2001 Wikipedia; 2004 Facebook; 2005 YouTube; 2007 iPhone; 2008 Android handset.
- 2012 AlexNet; 2016 AlphaGo; 2017 transformers; 2020 GPT-3; 2022 ChatGPT; 2023 GPT-4; 2024 GPT-4o; verified 2025–2026 AI and robotics events.

**Agent must independently verify dates and source URLs** using primary/authoritative sources before seeding. Where only month/year is established, preserve that precision rather than inventing a day. Each verified historical event requires at least one source. Add categories and concise explanations of societal impact. Avoid presenting subjective significance as an objective statistic.

## 11. Import/export, backup and security
- JSON export includes schema version, scenarios, events, sources, forecasts, curve points, categories and relationships.
- JSON import has dry-run preview, duplicate-ID conflict handling, validation, and atomic commit.
- SQLite backup uses SQLite backup API, not unsafe raw file copying during writes. Restore requires explicit confirmation and integrity checks.
- Seed script is idempotent and must not overwrite admin edits. Keep `data/` out of git.
- Sanitize/escape user content; never inject unsanitized HTML. Only allow `http(s)` source URLs. Prevent path traversal in backup/restore. Use CSRF safeguards/authentication if exposed beyond localhost.

## 12. Acceptance tests — mandatory
1. App loads at 1900 with both visible graph paths and axes; no console errors.
2. Graph genuinely fills the viewport at 1920×1080, 1366×768, and mobile 390×844.
3. Scroll advances year and draws curves; reverse scroll rewinds correctly.
4. Seek slider works both directions and remains synchronized with scrolling.
5. Play/Pause and Previous/Next work; playback stops at 2100.
6. Historical markers appear at exact source dates and not before.
7. Top-right year/event overlay has **no background or border** and shows source links.
8. Adding an event via form immediately creates a marker; reload/restart retains it.
9. Editing/archiving/restoring/deleting events updates the graph appropriately.
10. Adding/editing curve points changes interpolation and persists after restart.
11. Switching Baseline/Accelerated changes **only future** events/curves, including June 2027 vs June 2033 example; historical values unchanged.
12. Crossover annotation is calculated, not hardcoded; no crossover is also a valid state.
13. Invalid dates, bad URLs, out-of-range points and missing sources show useful validation errors.
14. Database export, import preview, backup and restore work correctly.
15. Keyboard, touch, reduced-motion and light/dark themes work.
16. Empty/malformed API response shows error/retry state, never blank page.
17. Playwright tests execute against the real running server; no uncaught JS exceptions.

## 13. Implementation phases
**Phase 1 — Foundation:** repository, SQLite migrations, seed infrastructure, API, shared types, validation, tests.

**Phase 2 — Visualization:** fullscreen SVG, two lines, exact-date axis, scrolling, seeking, playback, markers, year/event overlay, theme.

**Phase 3 — Administration:** event forms, source management, categories, point editor, live updates, persistence.

**Phase 4 — Scenarios:** separate forecast dates and control points, mode toggle, interpolation/crossover recalculation, URL state.

**Phase 5 — Quality:** historical research and sourced seed, responsive/accessibility review, import/export, backups, browser regression suite.

## 14. Agent execution instructions
- Implement the working application, not merely mockups or static HTML.
- Build and test each phase before proceeding. Do not claim a feature works without running relevant tests.
- Reproduce the specified fullscreen layout faithfully; do not replace it with a dashboard or constellation diagram.
- Treat events and curve points as **separate editable data**; neither automatically overwrites the other.
- Clearly label speculative future forecasts and conceptual indices.
- Maintain `README.md` with installation, commands, architecture, data model, scenario behaviour and known limitations.
- Deliver working source code, migrations, verified seed data, tests, and screenshots from actual browser runs.
- Final handoff must include test results and any incomplete requirements, with no fabricated verification.

## 15. Definition of done
A non-technical local user can launch THE SHIFT, scroll through a truly fullscreen 1900–2100 timeline, inspect sourced historical events, toggle between conservative and aggressive future forecasts, add a dated event through a form, edit both scenarios' forecast dates, edit graph points, refresh/restart the application without losing data, and reliably operate all controls. All mandatory acceptance tests pass.
