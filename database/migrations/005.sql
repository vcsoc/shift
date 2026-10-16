-- Age of AI forecasts from today; do not alter any shared historical anchors.
CREATE TABLE curve_points_v5 (
 id TEXT PRIMARY KEY, scenario_id TEXT REFERENCES scenarios(id), point_date TEXT NOT NULL,
 technology_index REAL NOT NULL CHECK(technology_index BETWEEN 0 AND 100),
 human_effort_index REAL NOT NULL CHECK(human_effort_index BETWEEN 0 AND 100),
 rationale TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((scenario_id IS NULL AND point_date <= '2026-10-13') OR
       (scenario_id = 'age-of-ai' AND point_date >= '2026-10-16') OR
       (scenario_id IS NOT NULL AND scenario_id != 'age-of-ai' AND point_date > '2026-10-13'))
);
INSERT INTO curve_points_v5 SELECT * FROM curve_points;
DROP TABLE curve_points;
ALTER TABLE curve_points_v5 RENAME TO curve_points;
CREATE UNIQUE INDEX shared_point_date ON curve_points(point_date) WHERE scenario_id IS NULL;
CREATE UNIQUE INDEX scenario_point_date ON curve_points(scenario_id,point_date) WHERE scenario_id IS NOT NULL;
CREATE TABLE event_curve_values_v5 (
 event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 series TEXT NOT NULL CHECK(series IN ('history','baseline','accelerated','exponential','age-of-ai')),
 technology_index REAL NOT NULL CHECK(technology_index BETWEEN 0 AND 100),
 human_effort_index REAL NOT NULL CHECK(human_effort_index BETWEEN 0 AND 100),
 rationale TEXT NOT NULL, PRIMARY KEY(event_id,series)
);
INSERT INTO event_curve_values_v5 SELECT * FROM event_curve_values;
DROP TABLE event_curve_values;
ALTER TABLE event_curve_values_v5 RENAME TO event_curve_values;
INSERT INTO migrations(version) VALUES(5);
