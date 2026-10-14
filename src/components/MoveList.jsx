import { Circle } from 'lucide-react'
import { formatEnginePoints } from '../engine/evaluation.js'

// --- POKROČILÁ GEOMETRICKÁ ANALÝZA GOMOKU ---

function getBoardState(moves, upToIndex) {
    const board = Array(15).fill(null).map(() => Array(15).fill(null));
    for (let i = 0; i <= upToIndex; i++) {
        const m = moves[i];
        if (m) board[m.y][m.x] = m.color;
    }
    return board;
}

// Pokročilé hledání řad s detailním popisem volných konců a mezer
function analyzeDirection(board, x, y, dx, dy, color) {
    let count = 1;
    let openEnds = 0;
    let blockedByOpponent = false;
    
    // Směr dopředu
    let i = 1;
    let emptySpacesAhead = 0;
    while (true) {
        let nx = x + i * dx, ny = y + i * dy;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) { blockedByOpponent = true; break; }
        if (board[ny][nx] === color) { count++; i++; }
        else if (board[ny][nx] === null) { openEnds++; break; }
        else { blockedByOpponent = true; break; }
    }
    
    // Směr dozadu
    i = 1;
    while (true) {
        let nx = x - i * dx, ny = y - i * dy;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) { blockedByOpponent = true; break; }
        if (board[ny][nx] === color) { count++; i++; }
        else if (board[ny][nx] === null) { openEnds++; break; }
        else { blockedByOpponent = true; break; }
    }

    return { count, openEnds, blockedByOpponent };
}

// Hlavní hloubková analýza tahu
function analyzeAdvancedContext(moves, moveIndex, rating) {
    if (moveIndex < 0 || moveIndex >= moves.length) return null;
    
    const move = moves[moveIndex];
    const color = move.color;
    const opponent = color === 'B' ? 'W' : 'B';
    const board = getBoardState(moves, moveIndex);
    
    const dirs = [[1,0], [0,1], [1,1], [1,-1]];
    
    let stats = {
        fives: 0,
        openFours: 0,
        closedFours: 0,
        openThrees: 0,
        closedThrees: 0,
        openTwos: 0, // Síla dvou otevřených dvojek
    };

    let defenseStats = {
        blockedFives: 0,
        blockedOpenFours: 0,
        blockedOpenThrees: 0,
    };

    for (let [dx, dy] of dirs) {
        // Ofenzivní analýza vytvořeného tvaru
        let off = analyzeDirection(board, move.x, move.y, dx, dy, color);
        if (off.count >= 5) stats.fives++;
        else if (off.count === 4 && off.openEnds === 2) stats.openFours++;
        else if (off.count === 4 && off.openEnds === 1) stats.closedFours++;
        else if (off.count === 3 && off.openEnds === 2) stats.openThrees++;
        else if (off.count === 3 && off.openEnds === 1) stats.closedThrees++;
        else if (off.count === 2 && off.openEnds === 2) stats.openTwos++;

        // Defenzivní analýza (co bychom umožnili soupeři, kdybychom zde netáhli)
        board[move.y][move.x] = opponent;
        let def = analyzeDirection(board, move.x, move.y, dx, dy, opponent);
        if (def.count >= 5) defenseStats.blockedFives++;
        else if (def.count === 4 && def.openEnds === 2) defenseStats.blockedOpenFours++;
        else if (def.count === 3 && def.openEnds === 2) defenseStats.blockedOpenThrees++;
        board[move.y][move.x] = color;
    }

    const r = rating?.rating;
    const isBadMove = r === 'blunder' || r === 'mistake' || r === 'inaccuracy';

    // --- VYHODNOCENÍ STRATEGIE A TAKTIKY ---

    // 1. Vítězné a matové kombinace
    if (stats.fives > 0) return "Vítězný tah! Zkompletována pětice.";
    if (stats.openFours > 0) return "Drtivý útok! Vytvořena otevřená čtyřka – soupeř nemůže pokrýt oba konce.";
    if (stats.closedFours > 1) return "Skvělá vidlička (4-4). Hrozíš ze dvou směrů uzavřenými čtyřkami.";
    if (stats.closedFours > 0 && stats.openThrees > 0) return "Klasická vidlička 4-3! Soupeř musí bránit čtyřku, čímž tě pustí k otevřené trojce a výhře.";

    // 2. Nucené obranné tahy
    if (defenseStats.blockedFives > 0 && !isBadMove) return "Nucený a kritický blok! Odvrátil jsi okamžitou prohru v podobě soupeřovy pětice.";
    if (defenseStats.blockedOpenFours > 0 && !isBadMove) return "Důležitá obrana. Zablokoval jsi soupeřovu otevřenou trojku dřív, než vyrostla v hrozbu.";
    if (defenseStats.blockedOpenThrees > 0 && !isBadMove) return "Nucený tah. Úspěšně jsi utnul rozvíjející se soupeřovu otevřenou trojku.";

    // 3. Přípravné fáze a budování pozice (Tvoje zadání)
    if (stats.openThrees > 1) return "Výborná pozice! Vytvořena dvojitá otevřená trojka (vidlička 3-3), která vede k jisté výhře.";
    if (stats.openThrees === 1 && stats.openTwos > 0) return "Silný tlak. Kombinace otevřené trojky a přípravných dvojek rozvrací soupeřovu obranu.";
    if (stats.openThrees > 0) return "Skvělý útočný tah. Otevřená trojka dává iniciativu a nutí soupeře reagovat.";
    
    // Příprava na dvojité otevřené trojky / síla otevřených dvojek
    if (stats.openTwos >= 2) return "Strategická příprava. Dvě silné otevřené dvojky vytvářejí podhoubí pro budoucí nebezpečné vidličky.";
    if (stats.openTwos === 1 && stats.closedThrees > 0) return "Poziciální příprava. Kombinace uzavřené trojky a volné dvojky rozšiřuje vliv na desce.";
    if (stats.openTwos > 0) return "Perspektivní rozvoj. Otevřená dvojka dává prostor pro budoucí stavbu trojek.";

    // 4. Reakce na chyby od enginu
    if (r === 'blunder') {
        if (stats.closedFours > 0 || stats.openTwos > 0) return "Falešná aktivita. Sice stavíš vlastní řadu, ale zcela ignoruješ smrtící hrozbu soupeře jinde.";
        return "Hrubá chyba. Tah přehlíží skrytou soupeřovu kombinaci nebo odevzdává klíčové tempo.";
    }
    if (r === 'mistake') return "Taktická chyba. Tah oslabuje tvoji strukturu a umožňuje soupeři převzít kontrolu.";
    if (r === 'inaccuracy') return "Drobná nepřesnost. Existovalo flexibilnější pokračování pro stavbu dvojek a trojek.";

    // 5. Poziční hodnocení nejlepších tahů
    if (r === 'brilliant') return "Geniální tah! Hluboký strategický tah, který mění charakter celé partie.";
    if (r === 'best') return "Nejlepší možný tah podle propočtu enginu. Perfektně drží rovnováhu či tlak.";
    if (r === 'excellent') return "Velmi silný tah, který zpevňuje tvoje kameny a omezuje soupeře.";

    return "Standardní vývojový tah. Buduje pozici bez okamžité taktické konfrontace.";
}

// --- KOMPONENTA SEZNAMU TAHŮ ---

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
          
          // Generování pokročilého komentáře postaveného na geometrii a síle tvarů
          const contextExplanation = showRatings && rating ? analyzeAdvancedContext(moves, index, rating) : null;

          return (
            <button 
                className={`move-row${isCurrent ? ' current' : ''}`} 
                type="button" 
                key={`${move.x}-${move.y}-${index}`} 
                onClick={() => onSelect(index + 1)} 
                role="listitem"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 12px', height: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span className="move-number">{String(index + 1).padStart(2, '0')}</span>
                      <span className={`move-stone ${move.color === 'B' ? 'move-stone-black' : 'move-stone-white'}`}><Circle size={12} fill="currentColor" strokeWidth={1.5} /></span>
                      <span className="move-coordinate">{String.fromCharCode(65 + move.x)}{15 - move.y}</span>
                  </div>
                  
                  {showRatings && rating ? <span className="move-rating-details">
                    <span className={`rating rating-${rating.rating}`}>{ratingLabels[rating.rating] ?? rating.rating}</span>
                    <span className="position-advantage" title="Kladné = výhoda bílého, záporné = výhoda černého">{formatEnginePoints(rating.pointAdvantage, true)}</span>
                  </span> : showRatings ? <span className="rating-placeholder">—</span> : null}
              </div>

              {contextExplanation && (
                  <span style={{ fontSize: '0.85em', color: 'var(--color-text-muted, #737373)', paddingLeft: '28px', marginTop: '4px', textAlign: 'left', fontStyle: 'italic', width: '100%' }}>
                      {contextExplanation}
                  </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default MoveList