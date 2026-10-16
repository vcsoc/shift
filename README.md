# THE SHIFT

A local-first, fullscreen 1900–2100 timeline of humanity and technology. React / TypeScript / Vite, D3 SVG scales, Fastify and SQLite. The two curves are **illustrative conceptual indices**, not empirical measurements or an automation rate. Their intersection does not mean humans are unnecessary.

## Launch

Requires Node.js 22.12+ and npm. SQLite uses a native module; if no prebuilt binary is available, installation requires Python and a C++ build toolchain.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on port 3001; Vite proxies `/api` to it.

For the production build:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Run commands from the repository root. `npm start` runs the TypeScript server using tsx; install development dependencies as well as runtime dependencies.

```sh
DATA_DIR=/absolute/path/to/private-data PORT=3001 npm start
```

Database and backups live in `DATA_DIR` (default `./data`), outside the static build and excluded from git. First startup migrates and seeds automatically. `npm run seed` is idempotent: a durable seed ledger prevents reseeding from overwriting changes or resurrecting removed records. To create a fresh timeline, choose a **new** data directory rather than deleting your current database.

## Use

- Scroll the page or swipe vertically to move through exact calendar time; reverse to rewind.
- Seek slider, Previous/Next and Play/Pause synchronize with page scroll. **Speed** means years advanced per real second while playing; changing it while paused explains that you must press Play.
- Keyboard: Space plays/pauses, Left/Right selects adjacent event dates, Home/End seeks endpoints. Controls and reached markers are keyboard accessible.
- Click a reached marker to inspect its event. Same-date events are clustered with a chooser.
- Baseline / Accelerated / **Exponential** changes only future assumptions; `?scenario=exponential` is shareable. Exponential explicitly continues a recent AI task-horizon trend under subjective adoption assumptions. Theme and resize preserve the seek date and selected coincident event.
- The **shield icon** with a Military On/Off tooltip defaults off and includes/excludes defence-related past and future events, without changing the curves. State persists in `?military=0|1`; event forms expose a military checkbox.
- The year is translucent grey in the bottom-right, below the milestone description.
- The **⚙** button opens unified **Events & curve points** administration. Pencil icons mark editable title rows. **Details** holds the common fields, sources and relationships; **Baseline / Accelerated / Exponential** tabs hold each forecast's date, description and curve values. Switching tabs preserves unsaved changes.
- Every published event coexists with a curve point at its date. Values are interpolated until explicitly edited, then saving changes the event and curve together. Historical values are shared by all scenarios; forecast values are independent. Same-date events share coordinates and conflicting explicit values are rejected.
- Original scaffold points remain under **Advanced anchors**, without creating fake historical events or losing existing data. Start, cutoff and endpoint anchors remain protected. Archiving/deleting removes the event's explicit contribution; restoring brings both back.
- Data & backups provides JSON export, validated dry-run import, explicit atomic replacement, SQLite backup and integrity-checked restore.

## Architecture & data

```text
apps/web/src/       fullscreen visualization, transport and admin forms
apps/api/src/       localhost server, API routes, transactional services
packages/shared/   shared Zod schemas, dates, interpolation and crossover
 database/         versioned migrations and researched seed records
 tests/            unit, React component, SQLite integration and browser tests
 docs/             source-verification ledger, acceptance report, screenshots
```

SQLite uses WAL, foreign keys, parameterized SQL, transactional writes, an audit log, value checks, and partial unique indexes for shared versus scenario point dates. Migrations 001–004 create scenarios, categories, events with military tagging, scenario forecasts, sources, retained scaffold anchors, event-owned curve values, relationships, audit history and durable seed ledgers. Existing installations receive the new scenario and events once, preserving prior estimates and user edits.

Historical cutoff: **13 October 2026**. Shared points end exactly there, so historical interpolation is identical in all three scenarios; independent future anchors follow it. Bounded piecewise-linear interpolation uses exact UTC date positions and cannot overshoot 0–100. Crossover is calculated from segment intersections; no intersection is a valid result. Approximate month/year dates use the first day only as a positioning anchor, and are displayed at their supported precision.

The seed contains **75 sourced historical/research milestones and 17 illustrative forecasts**, including four independent human-role cessation hypotheses, their combined milestone, and military support-function estimates. See [verification ledger](docs/seed-verification.md). Research-report submission dates are explicitly distinguished from product-launch dates. All scenario dates are assumptions, not validated predictions. The bounded-workflow example uses 30 June 2033 / 30 June 2027 / 31 March 2027 and retains near-term human governance and accountability. Separate long-run events hypothesize an end to human accountability, governance, escalation and auditing requirements in selected low-risk digital workflows. They require institutional changes, are not society-wide forecasts, and may never occur. See [research, formulas and estimate windows](docs/exponential-scenario.md).

### Index interpretation

- **Orange — technology integration/dependency:** a conceptual view of reliance on technology in daily life and infrastructure. It does not count deployed systems or measure economic output.
- **Cyan — human operational effort:** a conceptual view of direct coordination, intervention and supervision, remaining high through the historical cutoff. Future declines are scenario assumptions, not evidence that human judgment, responsibility or value declines.
- Both scales have arbitrary illustrative anchors. Comparing them does not make them equivalent quantities. Neither is an employment forecast or a percentage of automation.

### API

The `/api/v1` routes from the specification are implemented, plus `GET /admin/backups`. All API responses and structured validation errors are JSON. Event lists support `search`, `category`, `status`, `scenario`, `limit` and `offset`; reads are cached for the merged timeline and invalidated after writes. PATCH event/point routes accept partial fields and validate the merged record.

JSON exports use `schema_version: 3`, including event-owned curve values. Versions 1 and 2 can be imported; version 1 gains a third scenario without invented event dates. SQLite backups from migration 3 or newer restore normally; older layouts must first be exported to JSON using the old app. Sources, forecasts, relationships and curve values are nested within their events. Import previews validate dates, IDs, references, point uniqueness and essential anchors. Import commit requires `{confirm: "REPLACE", data: <export>}` and **replaces all timeline records atomically**, rather than silently merging duplicate IDs. Backup restore requires `{confirm: "RESTORE", name: <listed filename>}`; it validates integrity, foreign keys and schema, then transactionally restores tables including original timestamps/source IDs/audit history, recording the restore action.

### Security

Only localhost binding is supported; the server refuses public HOST values. Writes require a custom `X-Shift-Admin: local` header, a loopback Host and matching Origin when supplied. No CORS permission is granted. Browser text is escaped by React; sources permit only HTTP(S) URLs. Backup names cannot contain directory traversal. This is **not a multi-user authentication system**: do not publish the API via tunnels or reverse proxies without adding authentication and deployment-specific CSRF protection. Exports include private admin data and should be handled accordingly.

## Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm audit
```

Playwright builds the production frontend and launches the real Fastify/SQLite server on 127.0.0.1:3101 with a unique temporary data directory, never your own database. A real Vite proxy on port 5174 also tests development-mode backup creation and CSRF rejection. Screenshots from actual browser runs are committed under `docs/screenshots/`. Test traces on failure are ignored by git. The six annotation regressions also pass with `npx playwright install firefox` followed by `npx playwright test tests/e2e/annotations.spec.ts --browser=firefox`. See [acceptance report](docs/acceptance.md) for executed results and coverage limits, and the [eight-item annotation report](docs/ui-annotations.md) for the UI and data-model changes.

## Known limitations / incomplete specification details

- The required historical seed checklist is **not fully covered**. Independently verified additions are still needed for electrification, Sputnik, integrated circuit, Gagarin, handheld cellular call, TCP/IP transition, Wikipedia, Facebook, YouTube, first Android handset, ChatGPT launch and a 2026 AI/robotics milestone. Some attempted authoritative URLs returned 403/404. Existing 75 sourced events meet the minimum count but do not substitute for the complete checklist.
- Administration loads at most 500 events. API pagination is implemented, but the UI does not yet provide pagination controls for larger collections.
- Validation is presented in a field-keyed error summary; not every nested field has an adjacent inline error label.
- Scenario metadata can be edited through its API; a dedicated scenario-metadata form is not provided. Scenario-specific event descriptions/dates and curve points are editable in the UI.
- Chromium desktop/mobile emulation and six Firefox annotation regressions are covered; broader Firefox/WebKit, physical-device and screen-reader reviews have not been run. There is no claim that every exhaustive acceptance case is verified.
- Advanced scaffold-anchor deletion is permanent (with confirmation, protected boundaries and audit logging); event deletion is soft and restores its saved curve contribution. Import replacement and backup restore are explicitly destructive and should be preceded by a backup/export.

This is a working implementation, **not a claim of complete specification acceptance**. See the acceptance report for evidence and remaining verification work.
