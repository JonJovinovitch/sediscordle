import { memo, useMemo } from "react";

const BURST_COLORS = ["#36a852", "#f2871f", "#ffd166", "#7ee08f", "#ffb36b"];

// Confetti bits flying out of a board that just got solved.
function Burst() {
  const bits = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 70 + Math.random() * 90;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 30,
          r: Math.random() * 540 - 270,
          c: BURST_COLORS[i % BURST_COLORS.length],
          d: Math.random() * 0.12,
        };
      }),
    []
  );
  return (
    <div className="burst" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            "--x": `${b.x}px`,
            "--y": `${b.y}px`,
            "--r": `${b.r}deg`,
            background: b.c,
            animationDelay: `${b.d}s`,
          }}
        />
      ))}
    </div>
  );
}

// Back-to-back hard-mode timeouts show as one striped row with a count.
function groupRows(board, guesses) {
  const out = [];
  board.rows.forEach((colors, r) => {
    if (colors === "xxxxx") {
      const last = out[out.length - 1];
      if (last?.timeout) last.count++;
      else out.push({ timeout: true, count: 1, key: r });
    } else {
      out.push({ word: guesses[r], colors, key: r });
    }
  });
  return out;
}

function Board({ index, board, guesses, typing, playing, shake, celebrate }) {
  const rows = groupRows(board, guesses);
  const showInput = playing && !board.solved;

  return (
    <div
      className={`board${board.solved ? " solved" : ""}${celebrate ? " celebrate" : ""}`}
      aria-label={`Board ${index + 1}${board.solved ? ", solved" : ""}`}
    >
      <div className="board-label">
        <span>{index + 1}</span>
        {board.solved && <span className="board-check">✓ {board.solvedAt + 1}</span>}
      </div>
      {rows.map((row) =>
        row.timeout ? (
          <div className="row timeout-row" key={row.key} title="Time ran out">
            <span>⏱ {row.count > 1 ? `×${row.count}` : "time"}</span>
          </div>
        ) : (
          <div className="row" key={row.key}>
            {row.colors.split("").map((c, i) => (
              <div className={`tile ${c}`} key={i}>
                {row.word[i]}
              </div>
            ))}
          </div>
        )
      )}
      {showInput && (
        <div className={`row input${shake ? " shake" : ""}`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div className={`tile empty${typing[i] ? " filled" : ""}`} key={i}>
              {typing[i] || ""}
            </div>
          ))}
        </div>
      )}
      {celebrate && (
        <>
          <div className="solved-stamp" aria-hidden="true">
            SOLVED!
          </div>
          <Burst />
        </>
      )}
    </div>
  );
}

export default memo(Board);
