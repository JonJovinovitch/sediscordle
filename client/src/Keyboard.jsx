import { memo } from "react";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function Key({ letter, states, solved, onKey }) {
  // A key is "dead" once it's gray on every board that isn't solved yet.
  const open = states ? states.filter((_, i) => !solved[i]) : [];
  const dead = states && open.length > 0 && open.every((s) => s === "b");
  return (
    <button className={`key${dead ? " dead" : ""}`} onClick={() => onKey(letter)} aria-label={letter}>
      {states && (
        <span className="key-grid" aria-hidden="true">
          {states.map((s, i) => (
            <span key={i} className={`kg ${solved[i] ? "done" : s || ""}`} />
          ))}
        </span>
      )}
      <span className="key-letter">{letter}</span>
    </button>
  );
}

function Keyboard({ letterStates, solved, onKey }) {
  return (
    <div className="keyboard">
      {ROWS.map((row, r) => (
        <div className="key-row" key={row}>
          {r === 2 && (
            <button className="key wide" onClick={() => onKey("enter")}>
              Enter
            </button>
          )}
          {row.split("").map((l) => (
            <Key key={l} letter={l} states={letterStates[l]} solved={solved} onKey={onKey} />
          ))}
          {r === 2 && (
            <button className="key wide" onClick={() => onKey("back")} aria-label="Backspace">
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default memo(Keyboard);
