import { Circle } from 'lucide-react'
import { formatEnginePoints } from '../engine/evaluation.js'

function MoveList({ moves, ratings, currentMove, onSelect, ratingLabels, showRatings = true }) {
  return (
    <section className="panel move-panel">
      <div className="panel-heading move-heading">
        <div><span className="eyebrow">ZÁPIS PARTIE</span><h2>Tahy <span className="move-total">{moves.length}</span></h2></div>
        <span className="move-list-meta" title="Kladné číslo znamená výhodu bílého, záporné černého">Engine body: + bílý / - černý</span>
      </div>
      <div className="move-list" role="list" aria-label="Seznam tahů">
        {moves.length === 0 ? <div className="empty-moves">Přidejte první kámen kliknutím na desku.</div> : moves.map((move, index) => {
          const rating = ratings[index]
          const isCurrent = currentMove === index + 1
          return (
            <button className={`move-row${isCurrent ? ' current' : ''}`} type="button" key={`${move.x}-${move.y}-${index}`} onClick={() => onSelect(index + 1)} role="listitem">
              <span className="move-number">{String(index + 1).padStart(2, '0')}</span>
              <span className={`move-stone ${move.color === 'B' ? 'move-stone-black' : 'move-stone-white'}`}><Circle size={12} fill="currentColor" strokeWidth={1.5} /></span>
              <span className="move-coordinate">{String.fromCharCode(65 + move.x)}{15 - move.y}</span>
              {showRatings && rating ? <span className="move-rating-details">
                <span className={`rating rating-${rating.rating}`}>{ratingLabels[rating.rating] ?? rating.rating}</span>
                <span className="position-advantage" title="Kladné = výhoda bílého, záporné = výhoda černého">{formatEnginePoints(rating.pointAdvantage, true)}</span>
              </span> : showRatings ? <span className="rating-placeholder">—</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default MoveList