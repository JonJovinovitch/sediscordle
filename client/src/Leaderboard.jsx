import { useEffect, useState } from "react";
import { loadLeaderboard } from "./api.js";
import { formatDay, formatTime } from "./util.js";

const TABS = [
  { id: "streaks", label: "Win Streaks" },
  { id: "fastest", label: "Fastest Ever" },
  { id: "today", label: "Today" },
];

function Initial({ name }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{ background: `hsl(${h} 45% 38%)` }}>
      {name.trim()[0]?.toUpperCase() || "?"}
    </span>
  );
}

export default function Leaderboard({ onClose }) {
  const [tab, setTab] = useState("streaks");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadLeaderboard().then(setData, () => setError("Couldn't load the leaderboard."));
  }, []);

  const rows = data?.[tab] || [];

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

            <div className="lb-list">
              {error && <p className="muted pad">{error}</p>}
              {!data && !error && <p className="muted pad">Loading…</p>}
              {data && rows.length === 0 && (
                <p className="muted pad">
                  {tab === "today" ? "Nobody has finished today's puzzle yet." : "No wins yet. Be the first!"}
                </p>
              )}
              {rows.map((r, i) => (
                <div className={`lb-row${r.id === data.meId ? " me" : ""}`} key={r.id}>
                  <span className="rank">{i + 1}</span>
                  <Initial name={r.name} />
                  <span className="lb-name">
                    {r.name}
                    {r.hard && tab !== "streaks" && <span className="hard-tag">HARD</span>}
                  </span>
                  {tab === "streaks" && (
                    <span className="lb-val">
                      <b>{r.current_streak}</b> <small>day{r.current_streak === 1 ? "" : "s"}</small>
                      <em>best {r.best_streak}</em>
                    </span>
                  )}
                  {tab === "fastest" && (
                    <span className="lb-val">
                      <b>{formatTime(r.duration_ms)}</b>
                      <em>{formatDay(r.day)}</em>
                    </span>
                  )}
                  {tab === "today" && (
                    <span className="lb-val">
                      {r.won ? <b>{formatTime(r.duration_ms)}</b> : <b className="lost">{r.solved_count}/16</b>}
                      <em>{r.guesses} guesses</em>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="lb-foot muted">
              {tab === "streaks" && "Days in a row with all 16 boards solved."}
              {tab === "fastest" && "Each player's quickest full win, and the day they did it."}
              {tab === "today" && "Clock starts on your first guess. HARD = 60 seconds per guess."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
