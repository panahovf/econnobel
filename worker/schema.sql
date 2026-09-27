-- The EconNobel vote database (Cloudflare D1, which is SQLite).
-- Set it up once with:  npx wrangler d1 execute econnobel --remote --file schema.sql

-- One row per browser that has voted. "voter" is a random ID the page keeps on that device;
-- it isn't linked to a person. Changing your vote updates your row, so each browser counts once.
CREATE TABLE IF NOT EXISTS votes (
  voter      TEXT PRIMARY KEY,
  pick       TEXT NOT NULL,          -- who they picked: an ID from site/candidates.js, e.g. "pat6"
  name       TEXT NOT NULL,          -- the name they gave, or "Anonymous"
  updated_at INTEGER NOT NULL        -- when they last voted (milliseconds since 1970)
);
CREATE INDEX IF NOT EXISTS votes_by_time ON votes (updated_at);

-- Running totals, so showing the results doesn't mean counting every vote each time.
CREATE TABLE IF NOT EXISTS totals (
  pick  TEXT PRIMARY KEY,
  votes INTEGER NOT NULL
);
