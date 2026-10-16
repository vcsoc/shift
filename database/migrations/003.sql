ALTER TABLE events ADD COLUMN is_military INTEGER NOT NULL DEFAULT 0 CHECK(is_military IN (0,1));
CREATE INDEX event_military ON events(is_military,status);
INSERT INTO migrations(version) VALUES(3);
