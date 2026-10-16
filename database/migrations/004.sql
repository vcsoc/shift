CREATE TABLE event_curve_values (
 event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 series TEXT NOT NULL CHECK(series IN ('history','baseline','accelerated','exponential')),
 technology_index REAL NOT NULL CHECK(technology_index BETWEEN 0 AND 100),
 human_effort_index REAL NOT NULL CHECK(human_effort_index BETWEEN 0 AND 100),
 rationale TEXT NOT NULL,
 PRIMARY KEY(event_id,series)
);
INSERT INTO migrations(version) VALUES(4);
