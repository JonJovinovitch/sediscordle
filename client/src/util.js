export function formatTime(ms) {
  if (ms == null) return "–";
  const total = Math.max(0, Math.floor(ms / 100)); // tenths
  const tenths = total % 10;
  const secs = Math.floor(total / 10) % 60;
  const mins = Math.floor(total / 600) % 60;
  const hours = Math.floor(total / 36000);
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(mins)}:${pad(secs)}`
    : `${mins}:${pad(secs)}.${tenths}`;
}

export function formatDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const RANK = { g: 3, y: 2, b: 1 };

// For each letter, what we know about it on each of the 16 boards.
export function letterStates(game) {
  const states = {};
  game.boards.forEach((board, bi) => {
    board.rows.forEach((row, ri) => {
      const word = game.guesses[ri];
      if (word === ".....") return;
      for (let i = 0; i < 5; i++) {
        const letter = word[i];
        states[letter] ??= Array(game.boardCount).fill(null);
        const prev = states[letter][bi];
        if (!prev || RANK[row[i]] > RANK[prev]) states[letter][bi] = row[i];
      }
    });
  });
  return states;
}
