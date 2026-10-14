import { Circle } from 'lucide-react'

function MoveList({ moves, ratings, currentMove, onSelect, ratingLabels }) {
  return (
    <section className="panel move-panel">
      <div className="panel-heading move-heading">
        <div><span className="eyebrow">ZÁPIS PARTIE</span><h2>Tahy <span className="move-total">{moves.length}</span></h2></div>
        <span className="move-list-meta">Kliknutím přejít na pozici</span>
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
              {rating ? <span className={`rating rating-${rating.rating}`} title={`Pokles ${rating.drop}%`}>{ratingLabels[rating.rating]}</span> : <span className="rating-placeholder">—</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default MoveList