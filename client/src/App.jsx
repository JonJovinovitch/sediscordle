import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConfig, insideDiscord, loginWithDiscord, devLogin, loadGame, sendGuess, startHard } from "./api.js";
import { formatTime, letterStates } from "./util.js";
import Board from "./Board.jsx";
import Keyboard from "./Keyboard.jsx";
import Leaderboard from "./Leaderboard.jsx";
import { isMuted, setMuted, playSolved, playWin, unlockAudio } from "./sound.js";

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | devlogin | ready | error
  const [error, setError] = useState("");
  const [config, setConfig] = useState(null);
  const [data, setData] = useState(null); // { game, stats, me, guild }

  const start = useCallback(async (login) => {
    try {
      await login();
      setData(await loadGame());
      setPhase("ready");
    } catch (e) {
      console.error(e);
      setError(e.code === "discord_login_failed" ? "Discord login didn't work. Close and reopen the game." : String(e.message || e));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfig();
        setConfig(cfg);
        if (insideDiscord()) start(() => loginWithDiscord(cfg.clientId));
        else if (cfg.devLogin) setPhase("devlogin");
        else {
          setError("Open this game from inside Discord.");
          setPhase("error");
        }
      } catch {
        setError("Can't reach the game server.");
        setPhase("error");
      }
    })();
  }, [start]);

  if (phase === "loading") return <Splash text="Loading 16 boards…" />;
  if (phase === "error") return <Splash text={error} />;
  if (phase === "devlogin") return <DevLogin onGo={(name) => start(() => devLogin(name))} config={config} />;
  return <Game initial={data} />;
}

function Splash({ text }) {
  return (
    <div className="splash">
      <Logo />
      <p>{text}</p>
    </div>
  );
}

function Logo() {
  return (
    <div className="logo" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className={["g", "y", "g", "b"][(i * 7) % 4]} />
      ))}
    </div>
  );
}

function DevLogin({ onGo }) {
  const [name, setName] = useState("Tester");
  return (
    <div className="splash">
      <Logo />
      <p>Test mode (outside Discord). Pick a name:</p>
      <form
        className="devlogin"
        onSubmit={(e) => {
          e.preventDefault();
          onGo(name.trim() || "Tester");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
        <button className="btn">Play</button>
      </form>
    </div>
  );
}

function Game({ initial }) {
  const [game, setGame] = useState(initial.game);
  const [stats, setStats] = useState(initial.stats);
  const [typing, setTyping] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [shake, setShake] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [showEnd, setShowEnd] = useState(initial.game.status !== "playing");
  const [now, setNow] = useState(Date.now());
  const toastTimer = useRef();
  const [celebrating, setCelebrating] = useState(() => new Set());
  const [muted, setMutedState] = useState(isMuted());
  const [order, setOrder] = useState(() => loadOrder(initial.game.day, initial.game.boardCount));

  // Line our clock up with the server's so the timer is right.
  const offset = useRef(Date.parse(initial.game.serverNow) - Date.now());

  const playing = game.status === "playing";
  const solvedFlags = useMemo(() => game.boards.map((b) => b.solved), [game]);
  const solvedCount = solvedFlags.filter(Boolean).length;
  const states = useMemo(() => letterStates(game), [game]);

  useEffect(() => {
    if (!playing || !game.startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [playing, game.startedAt]);

  // Hard mode: seconds left to make this guess.
  const remaining =
    playing && game.hard && game.lastGuessAt
      ? game.guessLimitMs - (now + offset.current - Date.parse(game.lastGuessAt))
      : null;
  const refreshing = useRef(false);
  useEffect(() => {
    // Ran out of time: ask the server, which burns a guess and starts a fresh 60 seconds.
    if (remaining == null || remaining > -2200 || refreshing.current) return;
    refreshing.current = true;
    loadGame()
      .then((res) => {
        offset.current = Date.parse(res.game.serverNow) - Date.now();
        setGame(res.game);
        setStats(res.stats);
        flash("Time's up! +1 guess.");
      })
      .catch(() => {})
      .finally(() => (refreshing.current = false));
  }, [remaining]);

  const notStarted = playing && !game.startedAt;
  const goHard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await startHard();
      offset.current = Date.parse(res.game.serverNow) - Date.now();
      setGame(res.game);
      setNow(Date.now());
    } catch {
      flash("Hard mode has to be picked before your first guess.");
    } finally {
      setBusy(false);
    }
  };

  const elapsed = !playing
    ? game.durationMs
    : game.startedAt
      ? now + offset.current - Date.parse(game.startedAt)
      : 0;

  // Pop, confetti and a squeal for every board that just got solved.
  const celebrate = (before, after) => {
    const fresh = after.boards.map((b, i) => (b.solved && !before.boards[i].solved ? i : -1)).filter((i) => i >= 0);
    if (!fresh.length) return;
    const total = after.boards.filter((b) => b.solved).length;
    if (after.status === "won") playWin();
    else playSolved(total);
    setCelebrating((prev) => new Set([...prev, ...fresh]));
    setTimeout(
      () => setCelebrating((prev) => new Set([...prev].filter((i) => !fresh.includes(i)))),
      1500
    );
  };

  const shuffle = () => {
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    saveOrder(game.day, next);
  };

  const toggleSound = () => {
    setMuted(!muted);
    setMutedState(!muted);
    if (muted) {
      unlockAudio();
      playSolved(1);
    }
  };

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  };

  const submit = useCallback(async () => {
    if (busy || !playing) return;
    if (typing.length < 5) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return flash("Not enough letters");
    }
    setBusy(true);
    try {
      const res = await sendGuess(typing, game.day);
      offset.current = Date.parse(res.game.serverNow) - Date.now();
      celebrate(game, res.game);
      setGame(res.game);
      setStats(res.stats);
      setTyping("");
      if (res.game.status !== "playing") setTimeout(() => setShowEnd(true), 1400);
    } catch (e) {
      if (e.code === "not_a_word") {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        flash("Not in word list");
      } else if (e.code === "already_finished") {
        flash("You already finished today!");
      } else {
        flash("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }, [busy, playing, typing, game]);

  const onKey = useCallback(
    (k) => {
      if (!playing) return;
      unlockAudio();
      if (k === "enter") return submit();
      if (k === "back") return setTyping((t) => t.slice(0, -1));
      if (/^[a-z]$/.test(k)) setTyping((t) => (t.length < 5 ? t + k : t));
    },
    [playing, submit]
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Enter") onKey("enter");
      else if (e.key === "Backspace") onKey("back");
      else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toLowerCase());
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onKey]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <Logo />
          <div>
            <h1>SeDiscordle</h1>
            <span className="muted">
              #{game.puzzleNumber}
              {game.hard && <span className="hard-tag">HARD</span>}
            </span>
          </div>
        </div>
        <div className="meters">
          <Meter label="Guesses" value={game.guesses.length} />
          <Meter label="Solved" value={`${solvedCount}/${game.boardCount}`} />
          <Meter label="Time" value={formatTime(elapsed)} mono />
          {remaining != null ? (
            <Meter label="This guess" value={`⏱ ${Math.max(0, Math.ceil(remaining / 1000))}s`} warn={remaining < 10500} mono />
          ) : (
            <Meter label="Streak" value={`🔥 ${stats.currentStreak}`} />
          )}
        </div>
        <div className="actions">
          <button className="icon-btn" onClick={shuffle} title="Shuffle the boards around" aria-label="Shuffle boards">
            🔀
          </button>
          <button className="icon-btn" onClick={toggleSound} title={muted ? "Turn sound on" : "Turn sound off"} aria-label={muted ? "Turn sound on" : "Turn sound off"}>
            {muted ? "🔇" : "🔊"}
          </button>
          <button className="btn ghost" onClick={() => setShowBoard(true)}>
            🏆 <span className="hide-sm">Leaderboard</span>
          </button>
        </div>
      </header>

      <main className="boards">
        {order.map((i) => (
          <Board
            key={i}
            index={i}
            board={game.boards[i]}
            celebrate={celebrating.has(i)}
            guesses={game.guesses}
            typing={typing}
            playing={playing}
            shake={shake}
          />
        ))}
      </main>

      {notStarted && (
        <div className="mode-bar">
          <span>
            <b>Normal:</b> just start typing.
          </span>
          <button className="btn hard" onClick={goHard} disabled={busy}>
            🔥 Hard mode: 60 seconds per guess
          </button>
        </div>
      )}
      {remaining != null && (
        <div className="guess-clock" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(1, remaining / game.guessLimitMs)) * 100}%` }} className={remaining < 10500 ? "low" : ""} />
        </div>
      )}
      {playing ? (
        <Keyboard letterStates={states} solved={solvedFlags} onKey={onKey} />
      ) : (
        <div className="done-bar">
          <span>All 16 in {game.guesses.length} guesses and {formatTime(game.durationMs)}! New puzzle at midnight.</span>
          <button className="btn" onClick={() => setShowEnd(true)}>Results</button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      {showEnd && !playing && (
        <EndScreen
          game={game}
          stats={stats}
          onClose={() => setShowEnd(false)}
          onLeaderboard={() => {
            setShowEnd(false);
            setShowBoard(true);
          }}
        />
      )}
      {showBoard && <Leaderboard onClose={() => setShowBoard(false)} />}
    </div>
  );
}

function Meter({ label, value, mono, warn }) {
  return (
    <div className={`meter${warn ? " warn" : ""}`}>
      <span className="meter-label">{label}</span>
      <span className={`meter-value${mono ? " mono" : ""}`}>{value}</span>
    </div>
  );
}

function EndScreen({ game, stats, onClose, onLeaderboard }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel end" onClick={(e) => e.stopPropagation()}>
        <button className="close corner" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="eyebrow">SeDiscordle #{game.puzzleNumber}{game.hard ? " · Hard mode" : ""}</div>
        <h2>All 16. Nice.</h2>
        <div className="end-stats">
          <div>
            <b>{formatTime(game.durationMs)}</b>
            <span>time</span>
          </div>
          <div>
            <b>{game.guesses.length}</b>
            <span>guesses</span>
          </div>
          <div>
            <b>{stats.currentStreak}</b>
            <span>streak</span>
          </div>
          <div>
            <b>{stats.bestStreak}</b>
            <span>best</span>
          </div>
        </div>
        <div className="mini-grid">
          {game.boards.map((b, i) => (
            <span key={i} className="ok" title={b.answer?.toUpperCase()}>
              {b.solvedAt + 1}
            </span>
          ))}
        </div>
        <button className="btn full" onClick={onLeaderboard}>
          🏆 See the server leaderboard
        </button>
      </div>
    </div>
  );
}

// Board order is just for looks, remembered per day in this browser.
function loadOrder(day, count) {
  const base = Array.from({ length: count }, (_, i) => i);
  try {
    const saved = JSON.parse(localStorage.getItem("sediscordle-order") || "null");
    if (saved?.day === day && saved.order?.length === count) return saved.order;
  } catch {
    /* storage blocked */
  }
  return base;
}
function saveOrder(day, order) {
  try {
    localStorage.setItem("sediscordle-order", JSON.stringify({ day, order }));
  } catch {
    /* storage blocked */
  }
}
