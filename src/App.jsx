import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ChevronLeft, ChevronRight, CircleHelp, Cpu, FileUp, RotateCcw } from 'lucide-react'
import { parseGameText } from './engine/game.js'
import GomokuBoard from './components/GomokuBoard.jsx'
import MoveList from './components/MoveList.jsx'
import './App.css'

const EvaluationGraph = lazy(() => import('./components/EvaluationGraph.jsx'))
const SEARCH_STRENGTHS = {
  quick: { label: 'Rychlá', depth: 6, timeMs: 250 },
  balanced: { label: 'Vyvážená', depth: 10, timeMs: 750 },
  strong: { label: 'Silná', depth: 14, timeMs: 1500 },
}

const ratingLabels = {
  brilliant: 'Zářivý',
  best: 'Nejlepší',
  excellent: 'Výborný',
  inaccuracy: 'Nepřesnost',
  mistake: 'Chyba',
  blunder: 'Hrubá chyba',
}

function getRecommendation(winPercent) {
  if (winPercent > 60) return { title: 'Volit černou', detail: 'Pozice dává černému jasnou výhodu.', tone: 'black' }
  if (winPercent < 40) return { title: 'Volit bílou', detail: 'Pozice dává bílému jasnou výhodu.', tone: 'white' }
  return { title: 'Položit další 2 kameny', detail: 'Pozice je vyrovnaná. Pokračujte ve Swap2.', tone: 'even' }
}

function formatMoves(moves) {
  return moves.map(({ x, y, color }) => `${x},${y},${color === 'B' ? 1 : 2}`).join('\n')
}

function App() {
  const [moves, setMoves] = useState([])
  const [gameText, setGameText] = useState('')
  const [currentMove, setCurrentMove] = useState(0)
  const [viewMode, setViewMode] = useState('full')
  const [analysis, setAnalysis] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [engineMode, setEngineMode] = useState('starting')
  const [gameName, setGameName] = useState('Nová partie')
  const [engineStrength, setEngineStrength] = useState('balanced')
  const [showRawData, setShowRawData] = useState(false)
  const [rawData, setRawData] = useState('')
  const workerRef = useRef(null)
  const requestIdRef = useRef(0)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const worker = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = ({ data }) => {
      if (data.type === 'engine') {
        setEngineMode(data.mode)
        return
      }
      if (data.id !== requestIdRef.current) return
      if (data.type === 'raw') {
        setRawData((existing) => `${existing}${data.lines.join('\n')}\n`)
        return
      }
      if (data.type === 'progress') setProgress(data.progress)
      if (data.type === 'analysis') {
        setAnalysis(data)
        setEngineMode(data.engineMode)
        setProgress(100)
      }
      if (data.type === 'error') setError(data.message)
    }
    worker.onerror = () => setError('Analytický worker se nepodařilo spustit.')
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!workerRef.current) return
    const id = ++requestIdRef.current
    setAnalysis(null)
    setProgress(0)
    setRawData('')
    setError('')
    workerRef.current.postMessage({
      type: 'analyze',
      id,
      moves,
      limits: SEARCH_STRENGTHS[engineStrength],
    })
  }, [moves, engineStrength])

  const displayedMove = viewMode === 'swap2' ? Math.min(3, moves.length) : currentMove
  const board = useMemo(() => {
    const cells = Array.from({ length: 15 }, () => Array(15).fill(null))
    moves.slice(0, displayedMove).forEach(({ x, y, color }) => {
      if (cells[y]?.[x] === null) cells[y][x] = color
    })
    return cells
  }, [moves, displayedMove])
  const currentAnalysis = analysis?.positions?.[displayedMove]
  const recommendation = currentAnalysis ? getRecommendation(currentAnalysis.winPercent) : null
  const isBusy = !analysis && progress < 100

  function changePosition(nextMove) {
    setCurrentMove(Math.max(0, Math.min(moves.length, nextMove)))
  }

  function addMove(x, y) {
    if (moves.length >= 225) return
    if (viewMode === 'swap2' && moves.length >= 3) return
    if (viewMode !== 'swap2' && currentMove !== moves.length) return
    if (moves.some((move) => move.x === x && move.y === y)) return
    const nextMoves = [...moves, { x, y, color: moves.length % 2 === 0 ? 'B' : 'W' }]
    setMoves(nextMoves)
    setGameText(formatMoves(nextMoves))
    setCurrentMove(nextMoves.length)
  }

  function undoLastMove() {
    if (moves.length === 0) return
    const nextMoves = moves.slice(0, -1)
    setMoves(nextMoves)
    setGameText(formatMoves(nextMoves))
    setCurrentMove(nextMoves.length)
  }

  function updateGameText(value) {
    setGameText(value)
    if (!value.trim()) {
      setMoves([])
      setCurrentMove(0)
      setGameName('Nová partie')
      setError('')
      return
    }
    try {
      const parsed = parseGameText(value)
      setMoves(parsed)
      setCurrentMove(parsed.length)
      setViewMode('full')
      setGameName('Vložená partie')
      setError('')
    } catch (parseError) {
      setError(parseError.message)
    }
  }

  async function loadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseGameText(await file.text())
      setMoves(parsed)
      setGameText(formatMoves(parsed))
      setCurrentMove(parsed.length)
      setViewMode('full')
      setGameName(file.name.replace(/\.(sgf|txt|piskvork)$/i, ''))
      setError('')
    } catch (parseError) {
      setError(parseError.message)
    }
    event.target.value = ''
  }

  function resetGame() {
    setMoves([])
    setGameText('')
    setCurrentMove(0)
    setViewMode('full')
    setGameName('Nová partie')
    setError('')
  }

  const winPercent = currentAnalysis?.winPercent ?? 50
  const pvMove = viewMode === 'partial' ? currentAnalysis?.pv?.[0] : null

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Gomoku Review, úvod">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>gomoku<span className="brand-light">/review</span></span>
        </a>
        <div className="topbar-right">
          <span className={`engine-status ${engineMode === 'wasm' ? 'is-wasm' : ''}`}><span />{engineMode === 'wasm' ? 'WASM engine' : engineMode === 'starting' ? 'Inicializace enginu' : 'Lokální heuristika'}</span>
          <button className="icon-button help-button" type="button" title="O analýze" aria-label="O analýze"><CircleHelp size={17} /></button>
        </div>
      </header>

      <section className="page-heading" id="top">
        <div>
          <span className="eyebrow">ANALÝZA V PROHLÍŽEČI · SOUKROMÍ NA PRVNÍM MÍSTĚ</span>
          <h1>Rozbor partie</h1>
        </div>
        <div className="heading-actions">
          <button className="button button-subtle" type="button" onClick={resetGame}><RotateCcw size={15} /> Nová partie</button>
          <button className="button button-primary" type="button" onClick={() => fileInputRef.current?.click()}><FileUp size={16} /> Importovat partii</button>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".sgf,.txt,.piskvork,text/plain" onChange={loadFile} />
        </div>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="game-input panel">
        <div className="game-input-heading">
          <label htmlFor="game-text">Zápis partie <span>SGF nebo souřadnice x,y,hráč</span></label>
          <span className="game-input-count">{moves.length} {moves.length === 1 ? 'tah' : 'tahů'}</span>
        </div>
        <textarea
          id="game-text"
          value={gameText}
          onChange={(event) => updateGameText(event.target.value)}
          placeholder="Vložte SGF nebo zadejte tahy, například: 7,7,1&#10;8,7,2"
          rows={3}
          spellCheck={false}
          aria-label="SGF nebo textový zápis tahů"
        />
      </section>

      <nav className="mode-tabs" aria-label="Režim analýzy">
        <button type="button" className={viewMode === 'full' ? 'active' : ''} onClick={() => setViewMode('full')}>Celá partie</button>
        <button type="button" className={viewMode === 'partial' ? 'active' : ''} onClick={() => setViewMode('partial')}>Aktuální pozice</button>
        <button type="button" className={viewMode === 'swap2' ? 'active' : ''} onClick={() => setViewMode('swap2')}>Swap2 · úvod</button>
      </nav>

      <div className="analysis-layout">
        <section className="board-column">
          <div className="board-topline">
            <div className="game-label"><span className="game-dot" /> <strong>{gameName}</strong><span className="move-count">{moves.length} tahů</span></div>
            {viewMode === 'swap2' ? <span className="opening-tag">3 KAMENY</span> : <span className="turn-label">{displayedMove === 0 ? 'Výchozí pozice' : `${displayedMove}. tah`}<span> · {displayedMove % 2 === 0 ? 'na tahu černý' : 'na tahu bílý'}</span></span>}
          </div>
          <GomokuBoard board={board} lastMove={displayedMove > 0 ? moves[displayedMove - 1] : null} pvMove={pvMove} onCellClick={addMove} onUndo={undoLastMove} interactive={viewMode === 'swap2' ? moves.length < 3 : currentMove === moves.length} />
          <div className="board-controls">
            <button className="icon-button" type="button" title="Předchozí tah" aria-label="Předchozí tah" onClick={() => changePosition(displayedMove - 1)} disabled={viewMode === 'swap2' || displayedMove === 0}><ChevronLeft size={19} /></button>
            <div className="move-scrubber"><span>0</span><input aria-label="Vybraný tah" type="range" min="0" max={moves.length} value={displayedMove} disabled={viewMode === 'swap2'} onChange={(event) => changePosition(Number(event.target.value))} /><span>{moves.length}</span></div>
            <button className="icon-button" type="button" title="Další tah" aria-label="Další tah" onClick={() => changePosition(displayedMove + 1)} disabled={viewMode === 'swap2' || displayedMove >= moves.length}><ChevronRight size={19} /></button>
          </div>
          <div className="board-footnote"><span><span className="footnote-stone black-stone" /> Černý</span><span><span className="footnote-stone white-stone" /> Bílý</span><span className="pv-legend">Zvýrazněný kruh = doporučení enginu</span></div>
        </section>

        <section className="analysis-column">
          <div className="panel evaluation-panel">
            <div className="panel-heading evaluation-heading">
              <div><span className="eyebrow">POZICE PO {displayedMove} TAZÍCH</span><h2>Šance na výhru</h2></div>
              <span className="eval-chip"><Cpu size={14} /> {engineMode === 'wasm' ? 'WASM' : 'CPU'}</span>
            </div>
            <div className="win-split"><span className="win-side white-side"><span>Bílý</span><strong>{(100 - winPercent).toFixed(1)}<small>%</small></strong></span><div className="split-track"><span style={{ width: `${100 - winPercent}%` }} /></div><span className="win-side black-side"><span>Černý</span><strong>{winPercent.toFixed(1)}<small>%</small></strong></span></div>
            <div className="engine-controls">
              <label htmlFor="engine-strength">Nastavení síly</label>
              <select id="engine-strength" value={engineStrength} onChange={(event) => setEngineStrength(event.target.value)}>
                {Object.entries(SEARCH_STRENGTHS).map(([value, setting]) => <option key={value} value={value}>{setting.label} · hloubka {setting.depth}</option>)}
              </select>
            </div>
            <div className="raw-toggle-row">
              <button className="raw-toggle" type="button" aria-expanded={showRawData} onClick={() => setShowRawData((visible) => !visible)}>
                {showRawData ? 'Skrýt raw data enginu' : 'Zobrazit raw data enginu'}
              </button>
              {engineStrength && <span>{SEARCH_STRENGTHS[engineStrength].timeMs} ms / tah</span>}
            </div>
            {showRawData && <pre className="raw-engine-data" aria-live="polite">{rawData || 'Čekám na výstup enginu…'}</pre>}
            {viewMode === 'swap2' && moves.length < 3 && <div className="recommendation"><span className="recommendation-kicker">DOPORUČENÍ SWAP2</span><strong>Umístěte ještě {3 - moves.length} {moves.length === 2 ? 'kámen' : 'kameny'}</strong><p>Vyhodnocení se zobrazí po dokončení tříkamenového úvodu.</p></div>}
            {viewMode === 'swap2' && moves.length >= 3 && recommendation && <div className={`recommendation recommendation-${recommendation.tone}`}><span className="recommendation-kicker">DOPORUČENÍ SWAP2</span><strong>{recommendation.title}</strong><p>{recommendation.detail}</p></div>}
            {viewMode === 'partial' && pvMove && <div className="pv-callout"><span className="pv-mark">PV</span><div><strong>Nejlepší pokračování</strong><p>{String.fromCharCode(65 + pvMove.x)}{15 - pvMove.y} · tah {displayedMove + 1}</p></div><ArrowDownToLine size={16} /></div>}
            {isBusy && <div className="analysis-progress"><span style={{ width: `${progress}%` }} /></div>}
          </div>

          <Suspense fallback={<section className="panel graph-panel graph-loading" aria-label="Načítání grafu" />}>
            <EvaluationGraph analyses={analysis?.positions ?? []} viewMode={viewMode} currentMove={displayedMove} />
          </Suspense>

          <MoveList moves={moves} ratings={analysis?.ratings ?? []} currentMove={displayedMove} onSelect={(move) => { setViewMode('full'); changePosition(move) }} ratingLabels={ratingLabels} />
        </section>
      </div>
      <footer className="page-footer"><span>Analýza zůstává ve vašem zařízení.</span><span>{engineMode === 'wasm' ? 'Rapfi · WebAssembly' : 'Gomoku engine · Web Worker'}</span></footer>
    </main>
  )
}

export default App
