CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    points INT NOT NULL DEFAULT 0,
    owned_upgrades TEXT[] NOT NULL DEFAULT '{}'
);
