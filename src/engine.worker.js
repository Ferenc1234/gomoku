import { analyzeLocalPosition, rateMove, winProbability } from './engine/evaluation.js'

const SIZE = 15
let enginePromise
const wasmModulePromise = (async () => {
  try {
    const wasmUrl = new URL(`${import.meta.env.BASE_URL}engine/rapfi.js`, self.location.origin)
    const { default: createModule } = await import(/* @vite-ignore */ wasmUrl.href)
    return await createModule({ locateFile: (path) => new URL(path, wasmUrl).href })
  } catch {
    return null
  }
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
    if (!module || typeof module._evaluate_board !== 'function') return null
    return {
      evaluatePosition: ({ moves, limits }) => evaluateWithWasm(module, moves, limits),
    }
  })
  return enginePromise
}

function evaluateWithWasm(module, moves, limits = {}) {
  const moveText = moves.map(({ x, y, color }) => `${x},${y},${color === 'B' ? 1 : 2}`).join('\n')
  if (typeof module._set_search_limits === 'function') {
    module._set_search_limits(Number(limits.depth) || 10, Number(limits.timeMs) || 750)
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

async function analyzePosition(engine, moves, board, sideToMove, limits) {
  let result = null
  if (engine?.evaluatePosition) {
    result = await engine.evaluatePosition({ moves, board, sideToMove, limits })
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
    self.postMessage({ type: 'engine', mode: engineMode })
    const limits = {
      depth: Number(data.limits?.depth) || 10,
      timeMs: Number(data.limits?.timeMs) || 750,
    }
    const positions = []
    const ratings = []
    const board = createBoard([])
    const initialPosition = await analyzePosition(engine, [], board, 'B', limits)
    if (activeRequestId !== data.id) return
    positions.push(initialPosition)
    self.postMessage({ type: 'raw', id: data.id, lines: initialPosition.rawLines })
    for (let index = 0; index < data.moves.length; index += 1) {
      const move = data.moves[index]
      board[move.y][move.x] = move.color
      const positionMoves = data.moves.slice(0, index + 1)
      const sideToMove = move.color === 'B' ? 'W' : 'B'
      const position = await analyzePosition(engine, positionMoves, board, sideToMove, limits)
      if (activeRequestId !== data.id) return
      positions.push(position)
      ratings.push(rateMove(positions[index], positions[index + 1], move))
      self.postMessage({ type: 'raw', id: data.id, lines: position.rawLines })
      self.postMessage({ type: 'progress', id: data.id, progress: Math.round(((index + 1) / data.moves.length) * 100) })
    }
    if (activeRequestId === data.id) self.postMessage({ type: 'analysis', id: data.id, positions, ratings, engineMode })
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, message: error instanceof Error ? error.message : 'Analýza selhala.' })
  }
}