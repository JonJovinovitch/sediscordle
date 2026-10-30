import { useEffect, useState } from "react";
import { loadLeaderboard } from "./api.js";
import { formatDay, formatTime } from "./util.js";

const TABS = [
  { id: "today", label: "Today" },
  { id: "alltime", label: "All-Time Best" },
  { id: "streaks", label: "Win Streaks" },
];

const SORTS = [
  { id: "overall", label: "Overall" },
  { id: "guesses", label: "Fewest Guesses" },
  { id: "time", label: "Fastest" },
];

const FOOT = {
  overall: "Fewest guesses wins. Ties go to the faster time.",
  guesses: "Ranked by guesses only. Same count = same rank.",
  time: "Ranked by time only. Clock starts on your first guess.",
  streaks: "Days in a row you solved all 16 boards.",
};

// Sorts rows and gives each a rank. Tied rows share a rank (1, 2, 2, 4...).
function rank(rows, mode) {
  const byGuesses = (a, b) => a.guesses - b.guesses || a.duration_ms - b.duration_ms;
  const byTime = (a, b) => a.duration_ms - b.duration_ms || a.guesses - b.guesses;
  const sorted = [...rows].sort(mode === "time" ? byTime : byGuesses);
  const key =
    mode === "guesses" ? (r) => r.guesses : mode === "time" ? (r) => r.duration_ms : (r) => `${r.guesses}|${r.duration_ms}`;
  let last = null;
  let lastRank = 0;
  return sorted.map((r, i) => {
    const k = key(r);
    if (k !== last) {
      lastRank = i + 1;
      last = k;
    }
    return { ...r, rank: lastRank };
  });
}

function Initial({ name }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{ background: `hsl(${h} 45% 34%)` }}>
      {name.trim()[0]?.toUpperCase() || "?"}
    </span>
  );
}

export default function Leaderboard({ onClose }) {
  const [tab, setTab] = useState("today");
  const [sort, setSort] = useState("overall");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard().then(setData, () => setError("Couldn't load the leaderboard. Close it and try again."));
  }, []);

  let rows = [];
  if (data) {
    if (tab === "streaks") rows = data.streaks.map((r, i) => ({ ...r, rank: i + 1 }));
    else if (tab === "today") rows = rank(data.today, sort);
    else rows = rank(sort === "time" ? data.bestTime : data.bestGuesses, sort);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel leaderboard" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <div className="eyebrow">Server leaderboard</div>
            <h2>{data?.guild?.name || "Leaderboard"}</h2>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {data && !data.guild ? (
          <p className="muted pad">Leaderboards are per server. Launch the game from a server to see one.</p>
        ) : (
          <>
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`tab${tab === t.id ? " on" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab !== "streaks" && (
              <div className="sorts">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    className={`chip${sort === s.id ? " on" : ""}`}
                    onClick={() => setSort(s.id)}
                    aria-pressed={sort === s.id}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            <div className="lb-list">
              {error && <p className="muted pad">{error}</p>}
              {!data && !error && <p className="muted pad">Loading…</p>}
              {data && rows.length === 0 && (
                <p className="muted pad">
                  {tab === "today" ? "Nobody has finished today's puzzle yet." : "No wins yet. Be the first!"}
                </p>
              )}
              {rows.map((r) => (
                <div className={`lb-row${r.id === data.meId ? " me" : ""}`} key={r.id}>
                  <span className={`rank${r.rank <= 3 ? " podium" : ""}`}>{r.rank}</span>
                  <Initial name={r.name} />
                  <span className="lb-name">
                    {r.name}
                    {r.hard && tab !== "streaks" && <span className="hard-tag">HARD</span>}
                  </span>
                  {tab === "streaks" ? (
                    <span className="lb-val">
                      <b>
                        {r.current_streak} <small>day{r.current_streak === 1 ? "" : "s"}</small>
                      </b>
                      <em>best {r.best_streak}</em>
                    </span>
                  ) : (
                    <span className="lb-val">
                      <span className="lb-pair">
                        <b className={sort === "time" ? "dim" : ""}>{r.guesses}</b>
                        <small>guesses</small>
                        <b className={sort === "guesses" ? "dim" : ""}>{formatTime(r.duration_ms)}</b>
                      </span>
                      {tab === "alltime" && <em>{formatDay(r.day)}</em>}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="lb-foot muted">{tab === "streaks" ? FOOT.streaks : FOOT[sort]}</p>
          </>
        )}
      </div>
    </div>
  );
}
