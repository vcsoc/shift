# UI annotation batch 84299b06-bf0d-4169-9872-a487ed03bcde

All eight highlighted requests were reviewed against the supplied full-window screenshots. These changes supersede the earlier independent event/curve administration design; existing records are retained.

| Annotation | Implementation | Evidence |
|---|---|---|
| 1 | Milestone description above the year, both bottom-right. Year is grey at 45% opacity; overlay remains transparent. | Browser geometry/style assertions at 1366×768 and 390×844. |
| 2 | Military text toggle replaced by a shield icon, accessible name, state and hover/keyboard-focus tooltip. | Tooltip/state browser test. |
| 3 | Playback selector visibly labelled Speed, with explanatory help and an announcement that paused playback requires Play. | Browser test measures substantially more elapsed timeline time at 25 than 2 years/sec. |
| 4 | Fixed Vite's proxy Host rewrite, rather than weakening server Origin/Host checks. | Reproduced HTTP 403 through port 5173 before the fix, HTTP 200 after. Real Vite browser test on 5174 creates a SQLite backup; hostile Origin still returns 403. |
| 5 | Details/Baseline/Accelerated/Exponential tabs replace stacked scenario fieldsets; tabs remain available while scrolling. | Browser changes all three scenarios, switches tabs, and saves their different dates/coordinates together. |
| 6 | Title, kind, date precision and all common fields, sources and relationships live in Details. | Tab visibility and unsaved-state assertions. |
| 7 | Pencil SVG follows each editable title (including advanced anchors), with an edit tooltip. | Browser verifies pencil visibility. |
| 8 | Unified Events & curve points, with event-owned historical or per-scenario coordinates. No duplicate primary curve manager. | Browser save/move/reload tests and SQLite integration lifecycle, conflict, import/export, backup/restore and reopen tests. |

## Event/curve coexistence

- Every published event with a date contributes a coordinate to the effective timeline, even if its values are currently automatic.
- Automatic values follow the shape defined by the original scaffold anchors and any explicit event values. Adding an automatic event does not change the shape.
- Editing event indices makes that date an explicit curve control point. Editing the date moves its contribution. All changes save transactionally with the event, sources and forecasts.
- Historical coordinates are shared across scenarios. Future coordinates belong to the corresponding scenario tab. “Not forecast” has no scenario point until an estimate is supplied.
- Same-date events share one geometric point. Conflicting explicit coordinates are rejected instead of silently picking one event. Restoring an archived event also checks for conflicts.
- Archive, draft or soft-delete removes an event's contribution; restore reinstates it. Original scaffold anchors remain available under Advanced anchors, so no data is deleted and boundaries need not be fabricated as historical milestones.
- The military filter only controls milestone visibility. The conceptual curve includes all published event contributions consistently, whether military markers are shown or hidden.
- Migration 004 adds `event_curve_values`. Export schema version 3 includes those values; version-1/2 JSON remains importable. SQLite backups from migration 3 or later remain restorable, with absent older event values treated as automatic.

Implementation is in `packages/shared/src/event-points.ts`, `apps/api/src/db.ts`, and the `Admin`, `EventEditor`, and `DataTools` modules. This design leaves the underlying scaffold API compatible while making the ordinary editing workflow unified.

## Actual browser screenshots

- [Desktop bottom-right overlay](screenshots/annotations-overlay-1366.png)
- [Mobile bottom-right overlay](screenshots/annotations-overlay-390.png)
- [Unified event/curve editor](screenshots/annotations-unified-event-editor.png)
- [Scenario tab](screenshots/annotations-scenario-tab.png)
- [SQLite backup through Vite](screenshots/annotations-backup-vite.png)

The separate AI/company-catalog request is not included in this annotation batch and remains pending clarification of default state and scope.
