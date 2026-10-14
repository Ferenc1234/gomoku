const LETTERS = 'ABCDEFGHIJKLMNO'
const STAR_POINTS = new Set(['3,3', '7,3', '11,3', '3,7', '7,7', '11,7', '3,11', '7,11', '11,11'])

function coordinateLabel(x, y) {
  return `${LETTERS[x]}${15 - y}`
}

function GomokuBoard({ board, lastMove, pvMove, winningLine, onCellClick, onUndo, interactive }) {
  return (
    <div className="board-stage" onContextMenu={(event) => { event.preventDefault(); onUndo() }}>
      <div className="axis-top" aria-hidden="true">{Array.from({ length: 15 }, (_, x) => <span key={x}>{LETTERS[x]}</span>)}</div>
      <div className="board-with-axis">
        <div className="axis-left" aria-hidden="true">{Array.from({ length: 15 }, (_, y) => <span key={y}>{15 - y}</span>)}</div>
        <div className="board-grid" role="grid" aria-label="Deska Gomoku 15 krát 15">
          {board.flatMap((row, y) => row.map((stone, x) => {
            const isLast = lastMove?.x === x && lastMove?.y === y
            const isPv = pvMove?.x === x && pvMove?.y === y && !stone
            return (
              <button
                className={`board-cell${stone ? ` has-stone stone-${stone.toLowerCase()}` : ''}${isLast ? ' last-move' : ''}${isPv ? ' pv-cell' : ''}${STAR_POINTS.has(`${x},${y}`) && !stone ? ' star-point' : ''}`}
                key={`${x}-${y}`}
                type="button"
                role="gridcell"
                aria-label={`${coordinateLabel(x, y)}${stone ? `, ${stone === 'B' ? 'černý' : 'bílý'} kámen` : isPv ? ', nejlepší tah' : ', prázdné'}${interactive && !stone ? ', přidat tah' : ''}`}
                disabled={!interactive || Boolean(stone)}
                onClick={() => onCellClick(x, y)}
              >
                {stone && <span className="stone" />}
                {isPv && <span className="pv-stone">+</span>}
              </button>
            )
          }))}
          {winningLine?.length === 5 && (
            <svg className="winning-line" viewBox="0 0 100 100" aria-hidden="true">
              <line
                x1={`${(winningLine[0].x / 14) * 100}%`}
                y1={`${(winningLine[0].y / 14) * 100}%`}
                x2={`${(winningLine[4].x / 14) * 100}%`}
                y2={`${(winningLine[4].y / 14) * 100}%`}
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

export default GomokuBoard