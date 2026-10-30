// Talks to the Postgres database. Tables are created automatically on startup.
import pg from "pg";
import { randomBytes } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "\n*** SeDiscordle: DATABASE_URL is missing. On Railway, add a Postgres database and set\n" +
      "*** DATABASE_URL = ${{Postgres.DATABASE_URL}} on this service's Variables tab.\n"
  );
  process.exit(1);
}

// Railway's private network doesn't use SSL; public database URLs do.
const needsSsl = !/localhost|127\.0\.0\.1|\.railway\.internal/.test(url);
export const pool = new pg.Pool({
  connectionString: url,
  ssl: needsSsl && process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false,
  max: 10,
});

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar       TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS guilds (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS guild_members (
      guild_id  TEXT NOT NULL,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      guild_id   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS games (
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day          TEXT NOT NULL,
      guesses      JSONB NOT NULL DEFAULT '[]'::jsonb,
      started_at   TIMESTAMPTZ,
      finished_at  TIMESTAMPTZ,
      won          BOOLEAN,
      solved_count INT NOT NULL DEFAULT 0,
      duration_ms  BIGINT,
      PRIMARY KEY (user_id, day)
    );
    CREATE INDEX IF NOT EXISTS games_day_idx ON games (day);
    ALTER TABLE games ADD COLUMN IF NOT EXISTS hard BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE games ADD COLUMN IF NOT EXISTS last_guess_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS stats (
      user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      current_streak INT NOT NULL DEFAULT 0,
      best_streak    INT NOT NULL DEFAULT 0,
      last_win_day   TEXT,
      games_played   INT NOT NULL DEFAULT 0,
      games_won      INT NOT NULL DEFAULT 0
    );
  `);
  await pool.query(`DELETE FROM sessions WHERE created_at < now() - interval '30 days'`);
}

// A secret only the server knows, so nobody can work out tomorrow's words from the code.
export async function getPuzzleSecret() {
  if (process.env.PUZZLE_SECRET) return process.env.PUZZLE_SECRET;
  const fresh = randomBytes(24).toString("hex");
  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('puzzle_secret', $1) ON CONFLICT (key) DO NOTHING`,
    [fresh]
  );
  const { rows } = await pool.query(`SELECT value FROM settings WHERE key = 'puzzle_secret'`);
  return rows[0].value;
}
