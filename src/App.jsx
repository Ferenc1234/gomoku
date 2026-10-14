import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ChevronLeft, ChevronRight, CircleHelp, Cpu, FileUp, RotateCcw } from 'lucide-react'
import { formatEnginePoints, winProbability } from './engine/evaluation.js'
import { findWinningLine, parseGameText } from './engine/game.js'
import GomokuBoard from './components/GomokuBoard.jsx'
import MoveList from './components/MoveList.jsx'
import './App.css'

const EvaluationGraph = lazy(() => import('./components/EvaluationGraph.jsx'))
const SEARCH_STRENGTHS = {
  quick: { label: 'Rychlá', depth: 18, timeMs: 10000 },
  balanced: { label: 'Vyvážená', depth: 24, timeMs: 30000 },
  strong: { label: 'Silná', depth: 28, timeMs: 60000 },
  maximum: { label: 'Maximální', depth: 30, timeMs: 120000 },
}
const OPENING_LIMITS = { depth: 30, timeMs: 120000 }

const MODE_CHOICE_STORAGE_KEY = 'gomoku-mode-choice'

const ratingLabels = {
  brilliant: 'Zářivý',
  best: 'Nejlepší',
  excellent: 'Výborný',
  inaccuracy: 'Nepřesnost',
  mistake: 'Chyba',
  blunder: 'Hrubá chyba',
  winning: 'Vítězný tah',
}

function formatMoves(moves) {
  return moves.map(({ x, y }) => `${String.fromCharCode(97 + x)}${15 - y}`).join('')
}

function displayEngineWinner(score) {
  if (score === 0) return 'Vyrovnané'
  return score > 0 ? 'Černý' : 'Bílý'
}

function formatPrincipalVariation(pv) {
  return (pv ?? []).map(({ x, y }) => `${String.fromCharCode(65 + x)}${15 - y}`).join(' → ')
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
  const [engineCapabilities, setEngineCapabilities] = useState({ liveProgress: false, resizableTable: false })
  const [engineLoadError, setEngineLoadError] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [gameName, setGameName] = useState('Nová partie')
  const [engineStrength, setEngineStrength] = useState('balanced')
  const [engineConfig, setEngineConfig] = useState(SEARCH_STRENGTHS.balanced)
  const [tableSizeMb] = useState(0)
  const [allocatedTableSizeMb, setAllocatedTableSizeMb] = useState(null)
  const [searchProgress, setSearchProgress] = useState(null)
  const [searchStartedAt, setSearchStartedAt] = useState(null)
  const [elapsedNow, setElapsedNow] = useState(0)
  const [modeChoicePreference, setModeChoicePreference] = useState(() => {
    if (typeof window === 'undefined') return 'ask'
    return window.localStorage.getItem(MODE_CHOICE_STORAGE_KEY) ?? 'ask'
  })
  const [pendingModeChange, setPendingModeChange] = useState(null)
  const [rememberModeChoice, setRememberModeChoice] = useState(false)
  const [openingConfig, setOpeningConfig] = useState({ stones: 3 })
  const [showRawData, setShowRawData] = useState(false)
  const [rawData, setRawData] = useState('')
  const workerRef = useRef(null)
  const restartWorkerRef = useRef(() => null)
  const requestIdRef = useRef(0)
  const fileInputRef = useRef(null)

  const openingMoves = moves
  const openingMode = useMemo(() => viewMode === 'swap2' ? {
    stones: openingConfig.stones,
  } : null, [viewMode, openingConfig.stones])
  const analysisMoves = openingMode ? openingMoves : moves
  const visibleMoves = viewMode === 'swap2' ? openingMoves : moves
  const analysisLimits = openingMode ? OPENING_LIMITS : engineConfig

  useEffect(() => {
    const createWorker = () => {
      const worker = new Worker(new URL('./engine.worker.js', import.meta.url), { type: 'module' })
      workerRef.current = worker
      worker.onmessage = ({ data }) => {
        if (data.type === 'engine') {
          setEngineMode(data.mode)
          setEngineLoadError(data.loadError ?? '')
          setEngineCapabilities(data.capabilities ?? { liveProgress: false, resizableTable: false })
          return
        }
        if (data.id !== requestIdRef.current) return
        if (data.type === 'table-size') {
          setAllocatedTableSizeMb(data.allocatedMb)
          return
        }
        if (data.type === 'search-start') {
          setSearchProgress(data)
          setProgress((data.positionIndex / Math.max(data.totalPositions, 1)) * 100)
          return
        }
        if (data.type === 'search-progress') {
          setSearchProgress(data)
          setAnalysis((current) => {
            const positions = current?.positions ? [...current.positions] : []
            positions[data.positionIndex] = {
              score: data.score,
              winPercent: Number(winProbability(data.score).toFixed(1)),
              pv: data.pv?.length ? data.pv : data.bestMove ? [data.bestMove] : [],
              onlyWinningLine: false,
            }
            return { ...current, positions, ratings: current?.ratings ?? [] }
          })
          const depthProgress = Math.min(data.depth / Math.max(data.maxDepth, 1), 0.99)
          setProgress(Math.min(99, ((data.positionIndex + depthProgress) / Math.max(data.totalPositions, 1)) * 100))
          return
        }
        if (data.type === 'search-position-complete') {
          setSearchProgress((current) => current?.positionIndex === data.positionIndex ? null : current)
          setProgress(data.progress)
          return
        }
        if (data.type === 'raw') {
          setRawData((existing) => `${existing}${data.lines.join('\n')}\n`)
          return
        }
        if (data.type === 'progress') setProgress(data.progress)
        if (data.type === 'analysis') {
          setAnalysis(data)
          setSearchProgress(null)
          setEngineMode(data.engineMode)
          setProgress(100)
        }
        if (data.type === 'error') setError(data.message)
      }
      worker.onerror = () => setError('Analytický worker se nepodařilo spustit.')
      return worker
    }
    restartWorkerRef.current = () => {
      workerRef.current?.terminate()
      return createWorker()
    }
    createWorker()
    return () => {
      restartWorkerRef.current = () => null
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!workerRef.current) return
    const restartingWorker = requestIdRef.current > 0
    const worker = restartingWorker ? restartWorkerRef.current() : workerRef.current
    if (!worker) return
    const id = ++requestIdRef.current
    setAnalysis(null)
    setProgress(0)
    setSearchProgress(null)
    setSearchStartedAt(Date.now())
    setElapsedNow(0)
    setRawData('')
    setError('')
    const startTimer = window.setTimeout(() => {
      if (requestIdRef.current !== id) return
      worker.postMessage({
        type: 'analyze',
        id,
        moves: analysisMoves,
        opening: openingMode,
        limits: { ...analysisLimits, tableSizeMb, requestId: id },
      })
    }, restartingWorker ? 250 : 0)
    return () => window.clearTimeout(startTimer)
  }, [analysisMoves, analysisLimits, openingMode, tableSizeMb])
  const isAnalysisRunning = progress < 100 && !error
  useEffect(() => {
    if (!isAnalysisRunning || searchStartedAt === null) return undefined
    const updateElapsed = () => setElapsedNow(Date.now() - searchStartedAt)
    updateElapsed()
    const timer = window.setInterval(updateElapsed, 250)
    return () => window.clearInterval(timer)
  }, [isAnalysisRunning, searchStartedAt])

  const displayedMove = viewMode === 'swap2' ? Math.min(openingConfig.stones, moves.length) : currentMove
  const board = useMemo(() => {
    const cells = Array.from({ length: 15 }, () => Array(15).fill(null))
    visibleMoves.slice(0, displayedMove).forEach(({ x, y, color }) => {
      if (cells[y]?.[x] === null) cells[y][x] = color
    })
    return cells
  }, [visibleMoves, displayedMove])
  const currentAnalysis = analysis?.positions?.[displayedMove]
  const displayedWinner = findWinningLine(visibleMoves.slice(0, displayedMove))
  const openingRating = viewMode === 'swap2' ? analysis?.openingRating : null

  function changePosition(nextMove) {
    setCurrentMove(Math.max(0, Math.min(moves.length, nextMove)))
  }

  function addMove(x, y) {
    if (findWinningLine(moves)) return
    if (moves.length >= 225) return
    if (viewMode === 'swap2' && moves.length >= openingConfig.stones) return
    if (viewMode !== 'swap2' && currentMove !== moves.length) return
    if (moves.some((move) => move.x === x && move.y === y)) return
    const nextColor = moves.length % 2 === 0 ? 'B' : 'W'
    const nextMoves = [...moves, { x, y, color: nextColor }]
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
      const winningLine = findWinningLine(parsed)
      const playableMoves = winningLine ? parsed.slice(0, winningLine.moveIndex + 1) : parsed
      setMoves(playableMoves)
      setCurrentMove(playableMoves.length)
      if (playableMoves.length !== parsed.length) setGameText(formatMoves(playableMoves))
      setViewMode('full')
      setGameName('Vložená partie')
      setError(playableMoves.length !== parsed.length ? 'Tahům po vítězné pětici se nepřihlíží.' : '')
    } catch (parseError) {
      setError(parseError.message)
    }
  }

  async function loadFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = parseGameText(await file.text())
      const winningLine = findWinningLine(parsed)
      const playableMoves = winningLine ? parsed.slice(0, winningLine.moveIndex + 1) : parsed
      setMoves(playableMoves)
      setGameText(formatMoves(playableMoves))
      setCurrentMove(playableMoves.length)
      setViewMode('full')
      setGameName(file.name.replace(/\.(sgf|txt|piskvork)$/i, ''))
      setError(playableMoves.length !== parsed.length ? 'Tahům po vítězné pětici se nepřihlíží.' : '')
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

  function handleModeChange(nextMode) {
    if (nextMode === viewMode) return
    if (!moves.length) {
      setViewMode(nextMode)
      return
    }
    if (modeChoicePreference === 'keep') {
      setViewMode(nextMode)
      return
    }
    if (modeChoicePreference === 'new') {
      resetGame()
      setViewMode(nextMode)
      return
    }
    setRememberModeChoice(false)
    setPendingModeChange(nextMode)
  }

  function confirmModeChange(action) {
    if (!pendingModeChange) return
    if (rememberModeChoice) {
      const preference = action === 'keep' ? 'keep' : 'new'
      window.localStorage.setItem(MODE_CHOICE_STORAGE_KEY, preference)
      setModeChoicePreference(preference)
    }
    if (action === 'new') resetGame()
    setViewMode(pendingModeChange)
    setPendingModeChange(null)
    setRememberModeChoice(false)
  }

  function updateEngineConfig(field, value) {
    const parsedValue = Number(value)
    setEngineStrength('custom')
    setEngineConfig((current) => ({
      ...current,
      [field]: Number.isFinite(parsedValue) ? parsedValue : 0,
    }))
  }

  function updateEngineStrength(value) {
    setEngineStrength(value)
    if (value !== 'custom') setEngineConfig(SEARCH_STRENGTHS[value])
  }

  const winPercent = currentAnalysis?.winPercent
  const isCalculating = !error && (searchProgress?.positionIndex === displayedMove || !currentAnalysis)
  const pvMove = currentAnalysis?.pv?.[0]
  const principalVariation = currentAnalysis?.pv ?? []

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Gomoku Review, úvod">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>gomoku<span className="brand-light">/review</span></span>
        </a>
        <div className="topbar-right">
          <span className={`engine-status ${engineMode === 'wasm' ? 'is-wasm' : ''}`}><span />{engineMode === 'wasm' ? 'WASM engine' : engineMode === 'starting' ? 'Inicializace enginu' : 'Lokální heuristika'}</span>
          <button
            className="icon-button help-button"
            type="button"
            title="Nápověda a stav enginu"
            aria-label="Nápověda a stav enginu"
            aria-expanded={showHelp}
            aria-controls="engine-help"
            onClick={() => setShowHelp((visible) => !visible)}
          >
            <CircleHelp size={17} />
          </button>
          {showHelp && (
            <aside className="help-popover" id="engine-help" role="dialog" aria-labelledby="engine-help-title">
              <div className="help-popover-heading">
                <div>
                  <span className="eyebrow">STAV ANALÝZY</span>
                  <h2 id="engine-help-title">{engineMode === 'wasm' ? 'Rapfi WASM je připraven' : 'Rapfi WASM není načten'}</h2>
                </div>
                <button className="icon-button help-close" type="button" aria-label="Zavřít nápovědu" onClick={() => setShowHelp(false)}>×</button>
              </div>
              <p>{engineMode === 'wasm' ? 'Tahové pozice vyhodnocuje Rapfi běžící lokálně ve Web Workeru.' : 'Aplikace nyní používá záložní lokální heuristiku. K načtení Rapfi je potřeba vygenerovat WASM soubory.'}</p>
              {engineMode !== 'wasm' && <pre className="help-error">{engineLoadError || 'Čekám na odpověď workeru…'}</pre>}
              <div className="help-build">
                <span className="eyebrow">PO DOKONČENÍ EMSCRIPTEN SETUPU</span>
                <code>bash scripts/build-wasm.sh</code>
                <span>Výstup musí být v <code>public/engine/rapfi.js</code> a <code>rapfi.wasm</code>.</span>
              </div>
            </aside>
          )}
        </div>
      </header>

      <div className="workspace-layout">
        <section className="board-column">
          <div className="board-topline">
            <div className="game-label"><span className="game-dot" /> <strong>{gameName}</strong><span className="move-count">{viewMode === 'swap2' ? Math.min(moves.length, openingConfig.stones) : moves.length} tahů</span>{displayedWinner && <span className="game-result">{displayedWinner.color === 'B' ? 'Černý' : 'Bílý'} vítězí</span>}</div>
            {viewMode === 'swap2' ? <span className="opening-tag">{openingConfig.stones} KAMENŮ</span> : <span className="turn-label">{displayedMove === 0 ? 'Výchozí pozice' : `${displayedMove}. tah`}<span> · {displayedMove % 2 === 0 ? 'na tahu černý' : 'na tahu bílý'}</span></span>}
          </div>
          <GomokuBoard board={board} lastMove={displayedMove > 0 ? visibleMoves[displayedMove - 1] : null} pvMove={pvMove} winningLine={displayedWinner?.line} onCellClick={addMove} onUndo={undoLastMove} interactive={!displayedWinner && (viewMode === 'swap2' ? moves.length < openingConfig.stones : currentMove === moves.length)} />
          <div className="board-controls">
            <button className="icon-button" type="button" title="Předchozí tah" aria-label="Předchozí tah" onClick={() => changePosition(displayedMove - 1)} disabled={viewMode === 'swap2' || displayedMove === 0}><ChevronLeft size={19} /></button>
            <div className="move-scrubber"><span>0</span><input aria-label="Vybraný tah" type="range" min="0" max={moves.length} value={displayedMove} disabled={viewMode === 'swap2'} onChange={(event) => changePosition(Number(event.target.value))} /><span>{moves.length}</span></div>
            <button className="icon-button" type="button" title="Další tah" aria-label="Další tah" onClick={() => changePosition(displayedMove + 1)} disabled={viewMode === 'swap2' || displayedMove >= moves.length}><ChevronRight size={19} /></button>
          </div>
          <div className="board-footnote"><span><span className="footnote-stone black-stone" /> Černý</span><span><span className="footnote-stone white-stone" /> Bílý</span><span className="pv-legend">Zvýrazněný kruh = doporučení enginu</span></div>
        </section>

        <section className="workspace-side">
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
              <label htmlFor="game-text">Zápis partie <span>SGF nebo souřadnice g7j11k7</span></label>
              <span className="game-input-count">{moves.length} {moves.length === 1 ? 'tah' : 'tahů'}</span>
            </div>
            <textarea
              id="game-text"
              value={gameText}
              onChange={(event) => updateGameText(event.target.value)}
              placeholder="g7j11k7g10i5"
              rows={3}
              spellCheck={false}
              aria-label="SGF nebo kompaktní zápis tahů"
            />
          </section>

          <nav className="mode-tabs" aria-label="Režim analýzy">
            <button type="button" className={viewMode === 'full' ? 'active' : ''} onClick={() => handleModeChange('full')}>Celá partie</button>
            <button type="button" className={viewMode === 'swap2' ? 'active' : ''} onClick={() => handleModeChange('swap2')}>Swap2 · úvod</button>
          </nav>

          {viewMode === 'swap2' && <section className="opening-controls panel" aria-label="Nastavení zahájení">
            <label><span>Typ zahájení</span><select value={openingConfig.stones} onChange={(event) => setOpeningConfig({ stones: Number(event.target.value) })}><option value="3">Swap1 · 3 kameny</option><option value="5">Swap2 · 5 kamenů</option></select></label>
          </section>}

        <div className={`analysis-column${viewMode === 'swap2' ? ' opening-analysis' : ''}`}>
          <div className="panel evaluation-panel">
            <div className="panel-heading evaluation-heading">
              <div><span className="eyebrow">POZICE PO {displayedMove} TAZÍCH</span><h2>Šance na výhru</h2></div>
              <span className="eval-chip"><Cpu size={14} /> {engineMode === 'wasm' ? 'WASM' : 'CPU'}</span>
            </div>
            <div className="win-split"><span className="win-side white-side"><span>Engine body</span><strong>{currentAnalysis?.score === undefined ? '—' : formatEnginePoints(currentAnalysis.score)}</strong></span><div className="split-track"><span style={{ width: `${winPercent === undefined ? 50 : 100 - winPercent}%` }} /></div><span className="win-side black-side"><span>Výhoda</span><strong>{currentAnalysis?.score === undefined ? '—' : displayEngineWinner(currentAnalysis.score)}</strong></span>{isCalculating && <div className="score-loading-overlay" role="status"><span className="loading-spinner" /><span>Počítám pozici…</span></div>}</div>
            {viewMode === 'swap2' ? <div className="opening-limit-summary">Zahájení: hloubka 30 · 120 000 ms / tah</div> : <>
              <div className="engine-controls">
                <label htmlFor="engine-strength">Nastavení síly</label>
                <select id="engine-strength" value={engineStrength} onChange={(event) => updateEngineStrength(event.target.value)}>
                  {Object.entries(SEARCH_STRENGTHS).map(([value, setting]) => <option key={value} value={value}>{setting.label} · hloubka {setting.depth}</option>)}
                  <option value="custom">Vlastní nastavení</option>
                </select>
              </div>
              <div className="engine-parameter-grid">
                <label><span>Hloubka</span><input type="number" min="1" max="99" value={engineConfig.depth} onChange={(event) => updateEngineConfig('depth', event.target.value)} /></label>
                <label><span>Čas / tah (ms)</span><input type="number" min="50" max="120000" step="50" value={engineConfig.timeMs} onChange={(event) => updateEngineConfig('timeMs', event.target.value)} /></label>
              </div>
            </>}
            <div className="table-size-control">
              <label>Transpoziční tabulka <strong>Automaticky</strong></label>
              <span>{engineMode !== 'wasm' ? 'Dostupné s Rapfi WASM' : !engineCapabilities.resizableTable ? 'WASM je třeba znovu sestavit pro automatickou velikost' : allocatedTableSizeMb === null ? 'Zjišťuji bezpečnou velikost…' : `Rapfi alokoval ${allocatedTableSizeMb} MB`}</span>
            </div>
            <div className="raw-toggle-row">
              <button className="raw-toggle" type="button" aria-expanded={showRawData} onClick={() => setShowRawData((visible) => !visible)}>
                {showRawData ? 'Skrýt raw data enginu' : 'Zobrazit raw data enginu'}
              </button>
              <span>{analysisLimits.timeMs.toLocaleString('cs-CZ')} ms / tah</span>
            </div>
            {showRawData && <pre className="raw-engine-data" aria-live="polite">{rawData || 'Čekám na výstup enginu…'}</pre>}
            {viewMode === 'swap2' && moves.length < openingConfig.stones && <div className="recommendation"><span className="recommendation-kicker">HODNOCENÍ ZAHÁJENÍ</span><strong>Umístěte ještě {openingConfig.stones - moves.length} {openingConfig.stones - moves.length === 1 ? 'kámen' : 'kameny'}</strong><p>Celé zahájení se vyhodnotí společně po dokončení.</p></div>}
            {viewMode === 'swap2' && openingRating && <span className="opening-rating-inline">{openingRating.balanced ? 'Vyvážené zahájení' : `Výhoda ${openingRating.pointAdvantage > 0 ? 'bílého' : 'černého'}: ${formatEnginePoints(openingRating.pointAdvantage, true)}`}</span>}
            {principalVariation.length > 0 && <div className="pv-callout"><span className="pv-mark">PV</span><div><strong>Nejlepší cesta enginu</strong><p>{formatPrincipalVariation(principalVariation)} · po tahu {displayedMove}</p></div><ArrowDownToLine size={16} /></div>}
            {isAnalysisRunning && <>
              <div className="analysis-progress"><span style={{ width: `${progress}%` }} /></div>
              <div className="analysis-progress-meta">
                {searchProgress?.elapsedMs === undefined ? <span>{engineCapabilities.liveProgress ? 'Příprava vyhledávání…' : 'Výpočet běží…'} {((searchProgress?.elapsedMs ?? elapsedNow) / 1000).toFixed(1)} s</span> : <>
                  <span>Hloubka {searchProgress.depth}/{searchProgress.maxDepth}</span>
                  <span>{Math.round(searchProgress.nodes).toLocaleString('cs-CZ')} uzlů</span>
                  <span>{(searchProgress.elapsedMs / 1000).toFixed(1)} s</span>
                </>}
                <span>Pozice {(searchProgress?.positionIndex ?? displayedMove) + 1}/{searchProgress?.totalPositions ?? analysisMoves.length + 1}</span>
              </div>
            </>}
          </div>

          {viewMode !== 'swap2' && <Suspense fallback={<section className="panel graph-panel graph-loading" aria-label="Načítání grafu" />}>
            <EvaluationGraph analyses={analysis?.positions ?? []} viewMode="full" currentMove={displayedMove} />
          </Suspense>}

          <MoveList moves={viewMode === 'swap2' ? visibleMoves.slice(0, openingConfig.stones) : visibleMoves} ratings={analysis?.ratings ?? []} currentMove={displayedMove} onSelect={(move) => { setViewMode('full'); changePosition(move) }} ratingLabels={ratingLabels} showRatings={viewMode !== 'swap2'} />
        </div>
        </section>
      </div>
      {pendingModeChange && (
        <div className="mode-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="mode-confirm-title">
          <div className="mode-confirm-panel">
            <p className="eyebrow">PŘEPÍNÁNÍ REŽIMU</p>
            <h2 id="mode-confirm-title">Chcete zachovat aktuální pozici, nebo vytvořit novou?</h2>
            <div className="mode-confirm-actions">
              <button type="button" className="button button-subtle" onClick={() => confirmModeChange('keep')}>Zachovat pozici</button>
              <button type="button" className="button button-primary" onClick={() => confirmModeChange('new')}>Nová pozice</button>
            </div>
            <label className="remember-choice">
              <input type="checkbox" checked={rememberModeChoice} onChange={(event) => setRememberModeChoice(event.target.checked)} />
              <span>Vždy zvolit tuto možnost</span>
            </label>
            <button type="button" className="mode-confirm-cancel" onClick={() => setPendingModeChange(null)}>Zrušit</button>
          </div>
        </div>
      )}
      <footer className="page-footer"><span>Analýza zůstává ve vašem zařízení.</span><span>{engineMode === 'wasm' ? 'Rapfi · WebAssembly' : 'Gomoku engine · Web Worker'}</span></footer>
    </main>
  )
}

export default App
