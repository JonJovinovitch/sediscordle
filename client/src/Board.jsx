import { memo } from "react";

function Board({ index, board, guesses, typing, playing, shake }) {
  const rows = board.rows.map((colors, r) => ({ word: guesses[r], colors }));
  const showInput = playing && !board.solved;
  const failed = !playing && !board.solved;

  return (
    <div
      className={`board${board.solved ? " solved" : ""}${failed ? " failed" : ""}`}
      aria-label={`Board ${index + 1}${board.solved ? ", solved" : ""}`}
    >
      <div className="board-label">
        <span>{index + 1}</span>
        {board.solved && <span className="board-check">✓ {board.solvedAt + 1}</span>}
      </div>
      {rows.map((row, r) => (
        <div className="row" key={r}>
          {row.colors.split("").map((c, i) => (
            <div className={`tile ${c}`} key={i}>
              {c === "x" ? "" : row.word[i]}
            </div>
          ))}
        </div>
      ))}
      {showInput && (
        <div className={`row input${shake ? " shake" : ""}`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div className={`tile empty${typing[i] ? " filled" : ""}`} key={i}>
              {typing[i] || ""}
            </div>
          ))}
        </div>
      )}
      {failed && board.answer && (
        <div className="row reveal">
          {board.answer.split("").map((ch, i) => (
            <div className="tile answer" key={i}>
              {ch}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(Board);
