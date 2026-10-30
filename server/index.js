// The web server: logs people in through Discord, runs the game, keeps the leaderboards.
import express from "express";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pool, migrate, getPuzzleSecret } from "./db.js";
import {
  ALLOWED,
  BOARD_COUNT,
  HARD_GUESS_MS,
  TIMEOUT,
  todayString,
  addDays,
  puzzleNumber,
  wordsForDay,
  buildBoards,
} from "./puzzle.js";

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const TIME_ZONE = process.env.PUZZLE_TIMEZONE || "America/New_York";
const DEV_LOGIN = process.env.ALLOW_DEV_LOGIN === "true";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn("!! DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET are not set. Discord login will not work.");
}

await migrate();
const SECRET = await getPuzzleSecret();

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "20kb" }));

const today = () => todayString(TIME_ZONE);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Login ----------

async function upsertUser({ id, username, displayName, avatar }) {
  await pool.query(
    `INSERT INTO users (id, username, display_name, avatar) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET username = $2, display_name = $3, avatar = $4, updated_at = now()`,
    [id, username, displayName, avatar]
  );
}

async function joinGuild(guildId, guildName, userId) {
  if (!guildId) return;
  await pool.query(
    `INSERT INTO guilds (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = now()`,
    [guildId, guildName || "This server"]
  );
  await pool.query(
    `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET last_seen = now()`,
    [guildId, userId]
  );
}

async function newSession(userId, guildId) {
  const token = randomBytes(32).toString("hex");
  await pool.query(`INSERT INTO sessions (token, user_id, guild_id) VALUES ($1, $2, $3)`, [
    token,
    userId,
    guildId || null,
  ]);
  return token;
}

app.get("/api/config", (req, res) => {
  res.json({ clientId: CLIENT_ID, devLogin: DEV_LOGIN });
});

// Discord gives the game a one-time "code". We swap it for an access token,
// check who the player is and which server they're in, then start a session.
app.post(
  "/api/token",
  wrap(async (req, res) => {
    const { code, guildId } = req.body || {};
    if (!code) return res.status(400).json({ error: "missing_code" });

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Discord token exchange failed:", tokenData);
      return res.status(401).json({ error: "discord_login_failed" });
    }
    const accessToken = tokenData.access_token;
    const auth = { Authorization: `Bearer ${accessToken}` };

    const meRes = await fetch("https://discord.com/api/users/@me", { headers: auth });
    if (!meRes.ok) return res.status(401).json({ error: "discord_login_failed" });
    const me = await meRes.json();

    // Make sure they're really in the server they say they're playing from.
    let guild = null;
    if (guildId) {
      const gRes = await fetch("https://discord.com/api/users/@me/guilds", { headers: auth });
      if (gRes.ok) {
        const guilds = await gRes.json();
        const g = guilds.find((x) => x.id === String(guildId));
        if (g) guild = { id: g.id, name: g.name };
      }
    }

    await upsertUser({
      id: me.id,
      username: me.username,
      displayName: me.global_name || me.username,
      avatar: me.avatar,
    });
    await joinGuild(guild?.id, guild?.name, me.id);
    const session = await newSession(me.id, guild?.id);

    res.json({
      access_token: accessToken,
      session,
      user: { id: me.id, name: me.global_name || me.username },
      guild,
    });
  })
);

// Test-only login for playing in a normal browser. Off unless ALLOW_DEV_LOGIN=true.
app.post(
  "/api/dev-login",
  wrap(async (req, res) => {
    if (!DEV_LOGIN) return res.status(404).json({ error: "not_found" });
    const name = String(req.body?.name || "Tester").slice(0, 32);
    const guildId = req.body?.guildId ? String(req.body.guildId).slice(0, 32) : "dev-server";
    const id = `dev-${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    await upsertUser({ id, username: name, displayName: name, avatar: null });
    await joinGuild(guildId, "Test Server", id);
    const session = await newSession(id, guildId);
    res.json({ session, user: { id, name }, guild: { id: guildId, name: "Test Server" } });
  })
);

const requireSession = wrap(async (req, res, next) => {
  const token = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "not_logged_in" });
  const { rows } = await pool.query(
    `SELECT s.user_id, s.guild_id, u.display_name, g.name AS guild_name
       FROM sessions s JOIN users u ON u.id = s.user_id
       LEFT JOIN guilds g ON g.id = s.guild_id
      WHERE s.token = $1`,
    [token]
  );
  if (!rows[0]) return res.status(401).json({ error: "not_logged_in" });
  req.me = rows[0];
  next();
});

// ---------- The game ----------

const GRACE_MS = 2000;
const MAX_TIMEOUTS_PER_GAP = 100; // a little slack for slow connections in hard mode

async function getStats(userId, day) {
  const { rows } = await pool.query(`SELECT * FROM stats WHERE user_id = $1`, [userId]);
  const s = rows[0];
  if (!s) return { currentStreak: 0, bestStreak: 0, played: 0, won: 0 };
  const alive = s.last_win_day === day || s.last_win_day === addDays(day, -1);
  return {
    currentStreak: alive ? s.current_streak : 0,
    bestStreak: s.best_streak,
    played: s.games_played,
    won: s.games_won,
  };
}

function gameView(game, day) {
  const answers = wordsForDay(day, SECRET);
  const guesses = game?.guesses || [];
  const boards = buildBoards(answers, guesses);
  const finished = !!game?.finished_at;
  return {
    day,
    puzzleNumber: puzzleNumber(day),
    boardCount: BOARD_COUNT,
    guesses,
    boards: boards.map((b, i) => ({
      rows: b.rows,
      solved: b.solved,
      solvedAt: b.solvedAt,
      answer: finished ? answers[i] : undefined, // only revealed once you're done
    })),
    status: finished ? "won" : "playing",
    hard: !!game?.hard,
    guessLimitMs: HARD_GUESS_MS,
    startedAt: game?.started_at || null,
    lastGuessAt: game?.last_guess_at || null,
    durationMs: game?.duration_ms != null ? Number(game.duration_ms) : null,
    serverNow: new Date().toISOString(),
  };
}

// Grab the player's game row and lock it so two clicks can't collide.
async function lockGame(client, userId, day) {
  await client.query(`INSERT INTO games (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, day]);
  const { rows } = await client.query(`SELECT * FROM games WHERE user_id = $1 AND day = $2 FOR UPDATE`, [userId, day]);
  return rows[0];
}

// Save the game, and if it just ended, update streaks.
async function saveGame(client, userId, day, game, guesses, now) {
  const answers = wordsForDay(day, SECRET);
  const boards = buildBoards(answers, guesses);
  const solved = boards.filter((b) => b.solved).length;
  const won = solved === BOARD_COUNT;
  // No guess limit: the game only ends when all 16 boards are solved.
  const finishedAt = won ? now : null;
  const duration = finishedAt ? finishedAt - new Date(game.started_at) : null;

  await client.query(
    `UPDATE games SET guesses = $3, started_at = $4, finished_at = $5, won = $6,
            solved_count = $7, duration_ms = $8, hard = $9, last_guess_at = $10
      WHERE user_id = $1 AND day = $2`,
    [userId, day, JSON.stringify(guesses), game.started_at, finishedAt, finishedAt ? won : null,
     solved, duration, game.hard, game.last_guess_at]
  );

  if (finishedAt) {
    await client.query(`INSERT INTO stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
    const { rows } = await client.query(`SELECT * FROM stats WHERE user_id = $1 FOR UPDATE`, [userId]);
    const s = rows[0];
    let current = 0;
    let lastWin = s.last_win_day;
    if (won) {
      current = s.last_win_day === addDays(day, -1) ? s.current_streak + 1 : 1;
      lastWin = day;
    }
    await client.query(
      `UPDATE stats SET current_streak = $2, best_streak = GREATEST(best_streak, $2),
              last_win_day = $3, games_played = games_played + 1, games_won = games_won + $4
        WHERE user_id = $1`,
      [userId, current, lastWin, won ? 1 : 0]
    );
  }
}

// Hard mode: every 60 seconds without a guess adds a wasted guess to your count.
async function applyTimeouts(client, userId, day, game, now) {
  if (!game.hard || game.finished_at || !game.last_guess_at) return game;
  const waited = now - new Date(game.last_guess_at);
  let missed = Math.floor(Math.max(0, waited - GRACE_MS) / HARD_GUESS_MS);
  if (missed <= 0) return game;
  const capped = missed > MAX_TIMEOUTS_PER_GAP; // safety cap if someone walks away for hours
  if (capped) missed = MAX_TIMEOUTS_PER_GAP;
  const guesses = [...game.guesses, ...Array(missed).fill(TIMEOUT)];
  // Start the next 60 seconds where the last missed one ended (or right now, after a capped absence).
  game.last_guess_at = capped ? now : new Date(new Date(game.last_guess_at).getTime() + missed * HARD_GUESS_MS);
  await saveGame(client, userId, day, game, guesses, now);
  const { rows } = await client.query(`SELECT * FROM games WHERE user_id = $1 AND day = $2`, [userId, day]);
  return rows[0];
}

// Runs fn inside a database transaction with the player's game locked.
async function withGame(userId, day, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let game = await lockGame(client, userId, day);
    game = await applyTimeouts(client, userId, day, game, new Date());
    const result = await fn(client, game);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function freshView(userId, day) {
  const { rows } = await pool.query(`SELECT * FROM games WHERE user_id = $1 AND day = $2`, [userId, day]);
  return { game: gameView(rows[0], day), stats: await getStats(userId, today()) };
}

app.get(
  "/api/game",
  requireSession,
  wrap(async (req, res) => {
    const day = today();
    await withGame(req.me.user_id, day, async () => {});
    res.json({
      ...(await freshView(req.me.user_id, day)),
      me: { name: req.me.display_name },
      guild: req.me.guild_id ? { id: req.me.guild_id, name: req.me.guild_name } : null,
    });
  })
);

// Hard mode has to be picked before the first guess. Pressing Start begins the clock.
app.post(
  "/api/start-hard",
  requireSession,
  wrap(async (req, res) => {
    const day = today();
    const err = await withGame(req.me.user_id, day, async (client, game) => {
      if (game.started_at) return "already_started";
      const now = new Date();
      game.hard = true;
      game.started_at = now;
      game.last_guess_at = now;
      await saveGame(client, req.me.user_id, day, game, [], now);
    });
    if (err) return res.status(409).json({ error: err });
    res.json(await freshView(req.me.user_id, day));
  })
);

app.post(
  "/api/guess",
  requireSession,
  wrap(async (req, res) => {
    const word = String(req.body?.word || "").toLowerCase();
    const current = today();
    if (!/^[a-z]{5}$/.test(word) || !ALLOWED.has(word)) {
      return res.status(400).json({ error: "not_a_word" });
    }

    // If the clock rolled past midnight mid-game, let them finish yesterday's puzzle.
    let day = current;
    if (req.body?.day === addDays(current, -1)) {
      const { rows } = await pool.query(`SELECT * FROM games WHERE user_id = $1 AND day = $2`, [
        req.me.user_id,
        req.body.day,
      ]);
      if (rows[0] && !rows[0].finished_at && rows[0].guesses.length > 0) day = req.body.day;
    }

    const err = await withGame(req.me.user_id, day, async (client, game) => {
      if (game.finished_at) return "already_finished";
      const now = new Date();
      if (!game.started_at) game.started_at = now; // normal mode: clock starts on first guess
      game.last_guess_at = now;
      await saveGame(client, req.me.user_id, day, game, [...game.guesses, word], now);
    });
    if (err === "already_finished") {
      return res.status(409).json({ error: err, ...(await freshView(req.me.user_id, day)) });
    }
    res.json(await freshView(req.me.user_id, day));
  })
);

// ---------- Leaderboards (one per Discord server) ----------
// Scoring: fewer guesses is better, then faster time breaks ties.

const LB_LIMIT = 50;

app.get(
  "/api/leaderboard",
  requireSession,
  wrap(async (req, res) => {
    const guildId = req.me.guild_id;
    if (!guildId) return res.json({ guild: null, today: [], bestGuesses: [], bestTime: [], streaks: [] });
    const day = today();

    // Every finished game in this server today.
    const todayQ = pool.query(
      `SELECT u.id, u.display_name AS name, g.duration_ms, g.hard, g.day,
              jsonb_array_length(g.guesses) AS guesses
         FROM games g
         JOIN guild_members m ON m.user_id = g.user_id AND m.guild_id = $1
         JOIN users u ON u.id = g.user_id
        WHERE g.day = $2 AND g.won = true
        ORDER BY guesses ASC, g.duration_ms ASC
        LIMIT ${LB_LIMIT}`,
      [guildId, day]
    );
    // Each player's all-time best game, ranked by guesses then time.
    const bestGuessesQ = pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (g.user_id) u.id, u.display_name AS name, g.duration_ms, g.day, g.hard,
                jsonb_array_length(g.guesses) AS guesses
           FROM games g
           JOIN guild_members m ON m.user_id = g.user_id AND m.guild_id = $1
           JOIN users u ON u.id = g.user_id
          WHERE g.won = true
          ORDER BY g.user_id, jsonb_array_length(g.guesses) ASC, g.duration_ms ASC
       ) best ORDER BY guesses ASC, duration_ms ASC LIMIT ${LB_LIMIT}`,
      [guildId]
    );
    // Each player's all-time fastest game.
    const bestTimeQ = pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (g.user_id) u.id, u.display_name AS name, g.duration_ms, g.day, g.hard,
                jsonb_array_length(g.guesses) AS guesses
           FROM games g
           JOIN guild_members m ON m.user_id = g.user_id AND m.guild_id = $1
           JOIN users u ON u.id = g.user_id
          WHERE g.won = true
          ORDER BY g.user_id, g.duration_ms ASC, jsonb_array_length(g.guesses) ASC
       ) best ORDER BY duration_ms ASC, guesses ASC LIMIT ${LB_LIMIT}`,
      [guildId]
    );
    const streaksQ = pool.query(
      `SELECT u.id, u.display_name AS name, s.best_streak, s.games_won, s.games_played,
              CASE WHEN s.last_win_day IN ($2, $3) THEN s.current_streak ELSE 0 END AS current_streak
         FROM stats s
         JOIN guild_members m ON m.user_id = s.user_id AND m.guild_id = $1
         JOIN users u ON u.id = s.user_id
        WHERE s.games_played > 0
        ORDER BY current_streak DESC, s.best_streak DESC, s.games_won DESC
        LIMIT ${LB_LIMIT}`,
      [guildId, day, addDays(day, -1)]
    );
    const [t, bg, bt, s] = await Promise.all([todayQ, bestGuessesQ, bestTimeQ, streaksQ]);
    const num = (r) => ({ ...r, duration_ms: r.duration_ms != null ? Number(r.duration_ms) : null });
    res.json({
      guild: { id: guildId, name: req.me.guild_name },
      day,
      meId: req.me.user_id,
      today: t.rows.map(num),
      bestGuesses: bg.rows.map(num),
      bestTime: bt.rows.map(num),
      streaks: s.rows,
    });
  })
);

// ---------- Serve the game page ----------

const dist = fileURLToPath(new URL("../dist", import.meta.url));
if (existsSync(dist)) {
  app.get("/terms", (req, res) => res.sendFile("terms.html", { root: dist }));
  app.get("/privacy", (req, res) => res.sendFile("privacy.html", { root: dist }));
  app.use(express.static(dist, { index: "index.html" }));
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile("index.html", { root: dist });
  });
}

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

app.listen(PORT, () => {
  console.log(`SeDiscordle is running on port ${PORT} (puzzle day ${today()}, time zone ${TIME_ZONE})`);
});
