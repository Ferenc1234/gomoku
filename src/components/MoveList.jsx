import { Circle } from 'lucide-react'

function MoveList({ moves, ratings, currentMove, onSelect, ratingLabels, showRatings = true }) {
  return (
    <section className="panel move-panel">
      <div className="panel-heading move-heading">
        <div><span className="eyebrow">ZÁPIS PARTIE</span><h2>Tahy <span className="move-total">{moves.length}</span></h2></div>
        <span className="move-list-meta" title="100 bodů hodnocení enginu odpovídá 1 bodu výhody Gomoku">100 eval bodů = 1 bod výhody</span>
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
                <span className={`rating rating-${rating.rating}`} title={`Změna šance ${rating.drop}%`}>{ratingLabels[rating.rating] ?? rating.rating}</span>
                <span className={`move-points${rating.pointsChange < 0 ? ' points-lost' : ' points-gained'}`} title={rating.pointsChange < 0 ? `Ztráta ${rating.pointsLost.toFixed(1)} bodu` : `Zisk ${rating.pointsGained.toFixed(1)} bodu`}>
                  {rating.pointsChange > 0 ? '+' : rating.pointsChange < 0 ? '−' : ''}{Math.abs(rating.pointsChange).toFixed(1)} b
                </span>
                <span className={`position-advantage${rating.pointAdvantage < 0 ? ' advantage-white' : ''}`} title={`Celková výhoda: ${rating.pointAdvantage >= 0 ? 'černý' : 'bílý'} ${Math.abs(rating.pointAdvantage).toFixed(1)} bodu`}>
                  {rating.pointAdvantage >= 0 ? 'Č' : 'B'} {Math.abs(rating.pointAdvantage).toFixed(1)}
                </span>
              </span> : showRatings ? <span className="rating-placeholder">—</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default MoveList