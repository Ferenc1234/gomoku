import { analyzeLocalPosition, rateMove, rateOpening, winProbability } from './engine/evaluation.js'
import { findWinningLine } from './engine/game.js'

const SIZE = 15
function automaticTableSizeMb() {
  const deviceMemoryGb = Number(self.navigator?.deviceMemory) || 4
  const quarterMemoryMb = deviceMemoryGb * 1024 * 0.25
  return Math.min(512, Math.max(64, Math.floor(quarterMemoryMb / 16) * 16))
}
let enginePromise
let wasmLoadError = 'Soubor rapfi.js nebo rapfi-simd128.js se nepodařilo načíst.'
const wasmModulePromise = (async () => {
  const scriptCandidates = [
    `${import.meta.env.BASE_URL}engine/rapfi.js`,
    `${import.meta.env.BASE_URL}engine/rapfi-simd128.js`,
  ]

  for (const scriptPath of scriptCandidates) {
    try {
      const wasmUrl = new URL(scriptPath, self.location.origin)
      const { default: createModule } = await import(/* @vite-ignore */ wasmUrl.href)
      return await createModule({
        locateFile: (path) => {
          const resolvedPath = path.replace(/^rapfi-simd128(?=\.(?:js|wasm))/, 'rapfi')
          return new URL(resolvedPath, wasmUrl).href
        },
      })
    } catch (error) {
      wasmLoadError = error instanceof Error ? error.message : String(error)
    }
  }

  return null
})()

function createBoard(moves) {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
  for (const { x, y, color } of moves) {
    if (board[y]?.[x] === null) board[y][x] = color
  }
  return board
}

function piskvorkCommands(moves, limits) {
  const rows = moves.map(({ x, y, color }) => `${x},${y},${color === 'B' ? 1 : 2}`).join('\n')
  return `START ${SIZE}\nINFO max_depth ${limits.depth}\nINFO timeout_turn ${limits.timeMs}\nBOARD\n${rows}${rows ? '\n' : ''}DONE\n`
}

function parseCommandOutput(output) {
  if (output && typeof output === 'object' && Number.isFinite(Number(output.score))) {
    return { score: Number(output.score), pv: Array.isArray(output.pv) ? output.pv : [] }
  }
  const text = Array.isArray(output) ? output.join('\n') : String(output?.stdout ?? output?.output ?? output ?? '')
  const score = text.match(/(?:score|eval)\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i)
  const pvText = text.match(/(?:^|\n)\s*(?:pv|play)\s*[:=]?\s*([^\n]+)/i)?.[1]
  const coordinates = [...(pvText ?? '').matchAll(/(\d{1,2})\s*,\s*(\d{1,2})/g)]
  return {
    score: score ? Number(score[1]) : null,
    pv: coordinates.map((match) => ({ x: Number(match[1]), y: Number(match[2]) })),
  }
}

function rawOutputLines(output) {
  if (Array.isArray(output)) return output.flatMap((entry) => rawOutputLines(entry))
  if (typeof output === 'string') return output.split(/\r?\n/).filter(Boolean)
  if (!output || typeof output !== 'object') return []
  const lines = []
  if (output.stdout) lines.push(...String(output.stdout).split(/\r?\n/).filter(Boolean))
  if (output.stderr) lines.push(...String(output.stderr).split(/\r?\n/).filter(Boolean).map((line) => `stderr: ${line}`))
  if (output.raw) lines.push(...rawOutputLines(output.raw))
  return lines
}

function moveToProtocol(move) {
  return `${move.x},${move.y}`
}

async function initializeEngine() {
  if (enginePromise) return enginePromise
  enginePromise = wasmModulePromise.then((module) => {
    if (!module) return null
    if (typeof module._evaluate_board !== 'function') {
      wasmLoadError = 'Modul rapfi.js neexportuje funkci _evaluate_board.'
      return null
    }
    const supportsLiveSearchApi = Number(module._get_web_api_version?.()) >= 2
    return {
      supportsLiveSearchApi,
      evaluatePosition: ({ moves, limits, positionIndex }) => evaluateWithWasm(module, moves, limits, positionIndex, supportsLiveSearchApi),
    }
  })
  return enginePromise
}

function evaluateWithWasm(module, moves, limits = {}, positionIndex = 0, supportsLiveSearchApi = false) {
  const moveText = moves.map(({ x, y, color }) => `${x},${y},${color === 'B' ? 1 : 2}`).join('\n')
  if (typeof module._set_search_limits === 'function') {
    let allocatedTableSizeMb
    if (supportsLiveSearchApi) {
      allocatedTableSizeMb = module._set_search_limits(
        Number(limits.depth) || 10,
        Number(limits.timeMs) || 750,
        Number(limits.tableSizeMb) || 512,
        Number(limits.requestId) || 0,
        positionIndex,
        Number(limits.totalPositions) || 1,
      )
    } else {
      module._set_search_limits(Number(limits.depth) || 10, Number(limits.timeMs) || 750)
    }
    if (Number.isFinite(allocatedTableSizeMb) || !supportsLiveSearchApi) {
      self.postMessage({
        type: 'table-size',
        id: limits.requestId,
        requestedMb: limits.tableSizeMb,
        allocatedMb: allocatedTableSizeMb ?? 16,
        supported: supportsLiveSearchApi,
      })
    }
  }

  const inputPtr = module.allocateUTF8(moveText)
  try {
    const resultPtr = module._evaluate_board(inputPtr)
    if (!resultPtr) throw new Error('Rapfi nevrátil výsledek analýzy.')
    const result = JSON.parse(module.UTF8ToString(resultPtr))
    if (result.error) throw new Error(result.error)
    return result
  } finally {
    module._free(inputPtr)
  }
}

async function analyzePosition(engine, moves, board, sideToMove, limits, positionIndex) {
  self.postMessage({
    type: 'search-start',
    id: limits.requestId,
    positionIndex,
    totalPositions: limits.totalPositions,
  })
  let result = null
  if (engine?.evaluatePosition) {
    result = await engine.evaluatePosition({ moves, board, sideToMove, limits, positionIndex })
  } else if (engine?.runCommands) {
    result = await engine.runCommands(piskvorkCommands(moves, limits), limits)
  }
  const rawLines = rawOutputLines(result)
  const parsedResult = engine?.runCommands ? parseCommandOutput(result) : result
  const fallback = analyzeLocalPosition(board, sideToMove)
  const score = Number.isFinite(Number(parsedResult?.score)) ? Number(parsedResult.score) : fallback.score
  const pv = Array.isArray(parsedResult?.pv) && parsedResult.pv.length ? parsedResult.pv : fallback.pv
  if (rawLines.length === 0) {
    rawLines.push(engine
      ? '# Rapfi WASM direct API (C++ JSON result, no stdout stream).'
      : '# Lokální heuristika; nejde o stdout WASM enginu.')
    rawLines.push(`INFO depth ${engine ? limits.depth : 0}`)
    rawLines.push(`MESSAGE eval ${score}`)
    rawLines.push(`PV ${pv.map(moveToProtocol).join(' ')}`)
  }
  return {
    score,
    winPercent: Number(winProbability(score).toFixed(1)),
    pv,
    onlyWinningLine: Boolean(parsedResult?.onlyWinningLine ?? fallback.onlyWinningLine),
    rawLines,
  }
}

let activeRequestId = 0

self.onmessage = async ({ data }) => {
  if (data.type !== 'analyze') return
  activeRequestId = data.id
  try {
    const engine = await initializeEngine()
    const engineMode = engine ? 'wasm' : 'heuristic'
    self.postMessage({
      type: 'engine',
      mode: engineMode,
      loadError: engine ? '' : wasmLoadError,
      capabilities: {
        liveProgress: Boolean(engine?.supportsLiveSearchApi),
        resizableTable: Boolean(engine?.supportsLiveSearchApi),
      },
    })
    const analysisMoves = data.opening
      ? data.moves.slice(0, Number(data.opening.stones))
      : data.moves
    const limits = {
      depth: Number(data.limits?.depth) || 10,
      timeMs: Number(data.limits?.timeMs) || 750,
      tableSizeMb: Number(data.limits?.tableSizeMb) || automaticTableSizeMb(),
      requestId: data.id,
      totalPositions: analysisMoves.length + 1,
    }
    const positions = Array(data.opening ? analysisMoves.length + 1 : 1)
    const ratings = data.opening ? Array(analysisMoves.length).fill(null) : []
    const board = createBoard([])
    const initialPosition = data.opening
      ? { score: 0, winPercent: 50, pv: [], onlyWinningLine: false, rawLines: [] }
      : await analyzePosition(engine, [], board, 'B', limits, 0)
    if (activeRequestId !== data.id) return
    if (!data.opening) self.postMessage({
      type: 'search-position-complete',
      id: data.id,
      positionIndex: 0,
      progress: Math.round((1 / limits.totalPositions) * 100),
    })
    positions[0] = initialPosition
    if (!data.opening) self.postMessage({ type: 'raw', id: data.id, lines: initialPosition.rawLines })
    const indexes = data.opening
      ? (analysisMoves.length ? [analysisMoves.length - 1] : [])
      : analysisMoves.map((_move, index) => index)
    for (const index of indexes) {
      const move = analysisMoves[index]
      if (data.opening) {
        for (let boardIndex = 0; boardIndex <= index; boardIndex += 1) {
          const openingMove = analysisMoves[boardIndex]
          board[openingMove.y][openingMove.x] = openingMove.color
        }
      } else {
        board[move.y][move.x] = move.color
      }
      const positionMoves = analysisMoves.slice(0, index + 1)
      const sideToMove = move.color === 'B' ? 'W' : 'B'
      const winningLine = findWinningLine(positionMoves)
      const position = winningLine
        ? {
            score: winningLine.color === 'B' ? 10000 : -10000,
            winPercent: winningLine.color === 'B' ? 100 : 0,
            pv: [],
            onlyWinningLine: false,
            winner: winningLine.color,
            rawLines: [`MESSAGE ${winningLine.color} wins with exactly five in a row.`],
          }
        : await analyzePosition(engine, positionMoves, board, sideToMove, limits, index + 1)
      if (activeRequestId !== data.id) return
      if (!winningLine) self.postMessage({
        type: 'search-position-complete',
        id: data.id,
        positionIndex: index + 1,
        progress: Math.round(((index + 2) / limits.totalPositions) * 100),
      })
      positions[index + 1] = position
      if (!data.opening) ratings.push(rateMove(positions[index], position, move))
      self.postMessage({ type: 'raw', id: data.id, lines: position.rawLines })
      self.postMessage({ type: 'progress', id: data.id, progress: Math.round(((index + 2) / limits.totalPositions) * 100) })
      if (winningLine) break
    }
    if (activeRequestId === data.id) self.postMessage({
      type: 'analysis',
      id: data.id,
      positions,
      ratings,
      openingRating: data.opening && positions[analysisMoves.length] ? rateOpening(positions[analysisMoves.length]) : null,
      engineMode,
    })
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, message: error instanceof Error ? error.message : 'Analýza selhala.' })
  }
}