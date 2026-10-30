// The game rules: picking the daily 16 words and coloring guesses.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const here = new URL(".", import.meta.url);
const readList = (name) =>
  readFileSync(new URL(`data/${name}`, here), "utf8")
    .split(/\r?\n/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{5}$/.test(w));

export const ANSWERS = readList("answers.txt");
export const ALLOWED = new Set([...readList("allowed.txt"), ...ANSWERS]);

export const BOARD_COUNT = 16;
export const MAX_GUESSES = 21;
export const HARD_GUESS_MS = 60_000; // hard mode: 60 seconds per guess
export const TIMEOUT = "....."; // a guess burned because the hard-mode clock ran out
const FIRST_DAY = "2026-01-01"; // puzzle #1

// "YYYY-MM-DD" for "now" in the chosen time zone (new puzzle at midnight there).
export function todayString(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function puzzleNumber(day) {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}

// Small seeded random number generator so the same day always gives the same words.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();
export function wordsForDay(day, secret) {
  const key = `${secret}:${day}`;
  if (cache.has(key)) return cache.get(key);
  const seed = createHash("sha256").update(key).digest().readUInt32LE(0);
  const rand = mulberry32(seed);
  const pool = [...ANSWERS];
  const picked = [];
  for (let i = 0; i < BOARD_COUNT; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
    picked.push(pool[i]);
  }
  cache.set(key, picked);
  if (cache.size > 20) cache.delete(cache.keys().next().value);
  return picked;
}

// Returns a 5-letter string: g = green, y = yellow, b = gray.
export function scoreGuess(guess, answer) {
  const result = ["b", "b", "b", "b", "b"];
  const left = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) result[i] = "g";
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "g") continue;
    if (left[guess[i]] > 0) {
      result[i] = "y";
      left[guess[i]]--;
    }
  }
  return result.join("");
}

// Turns a list of guesses into what each of the 16 boards looks like.
export function buildBoards(answers, guesses) {
  return answers.map((answer) => {
    const rows = [];
    let solvedAt = null;
    for (let i = 0; i < guesses.length; i++) {
      if (guesses[i] === TIMEOUT) {
        rows.push("xxxxx");
        continue;
      }
      rows.push(scoreGuess(guesses[i], answer));
      if (guesses[i] === answer) {
        solvedAt = i;
        break;
      }
    }
    return { rows, solved: solvedAt !== null, solvedAt };
  });
}
