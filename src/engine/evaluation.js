const SIZE = 15
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]]

function patternValue(length, openEnds) {
  if (length === 5) return 10000
  if (length > 5) return 0
  if (length === 4) return openEnds === 2 ? 900 : openEnds === 1 ? 180 : 0
  if (length === 3) return openEnds === 2 ? 95 : openEnds === 1 ? 20 : 0
  if (length === 2) return openEnds === 2 ? 12 : openEnds === 1 ? 3 : 0
  return 0
}

export function evaluateBoard(board) {
  const totals = { B: 0, W: 0 }
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const color = board[y][x]
      if (!color) continue
      for (const [dx, dy] of DIRECTIONS) {
        const beforeX = x - dx
        const beforeY = y - dy
        if (board[beforeY]?.[beforeX] === color) continue
        let length = 0
        let nextX = x
        let nextY = y
        while (board[nextY]?.[nextX] === color) {
          length += 1
          nextX += dx
          nextY += dy
        }
        const openEnds = Number(board[y - dy]?.[x - dx] === null) + Number(board[nextY]?.[nextX] === null)
        totals[color] += patternValue(length, openEnds)
      }
    }
  }
  return totals.B - totals.W
}

export function winProbability(score, scale = 0.01) {
  const exponent = Math.max(-60, Math.min(60, scale * score))
  const probability = 100 / (1 + Math.exp(-exponent))
  return Math.max(1e-9, Math.min(100 - 1e-9, probability))
}

export function enginePoints(score) {
  return Math.round(Number(score || 0))
}

export function displayEnginePoints(score) {
  return -enginePoints(score)
}

export function formatEnginePoints(score, alreadyDisplayed = false) {
  const value = alreadyDisplayed ? enginePoints(score) : displayEnginePoints(score)
  const absolute = Math.abs(value)
  if (absolute >= 29500) {
    const movesToMate = Math.max(1, Math.ceil((30000 - absolute) / 2))
    return `${value < 0 ? '-' : ''}M${movesToMate}`
  }
  return String(value)
}

function isWinningMove(board, x, y, color) {
  board[y][x] = color
  let wins = false
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1
    for (const direction of [-1, 1]) {
      let nextX = x + dx * direction
      let nextY = y + dy * direction
      while (board[nextY]?.[nextX] === color) {
        count += 1
        nextX += dx * direction
        nextY += dy * direction
      }
    }
    if (count === 5) wins = true
  }
  board[y][x] = null
  return wins
}

function candidateMoves(board) {
  const candidates = new Set()
  let hasStone = false
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!board[y][x]) continue
      hasStone = true
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          const candidateX = x + offsetX
          const candidateY = y + offsetY
          if (board[candidateY]?.[candidateX] === null) candidates.add(`${candidateX},${candidateY}`)
        }
      }
    }
  }
  if (!hasStone) return [{ x: 7, y: 7 }]
  return [...candidates].map((coordinate) => {
    const [x, y] = coordinate.split(',').map(Number)
    return { x, y }
  })
}

export function findPrincipalVariation(board, sideToMove, depth = 3) {
  const working = board.map((row) => [...row])
  const pv = []
  let color = sideToMove
  let onlyWinningLine = false
  for (let ply = 0; ply < depth; ply += 1) {
    const candidates = candidateMoves(working)
    if (candidates.length === 0) break
    const wins = candidates.filter(({ x, y }) => isWinningMove(working, x, y, color))
    if (wins.length > 0) {
      onlyWinningLine = wins.length === 1
      const choice = wins[0]
      pv.push(choice)
      working[choice.y][choice.x] = color
      break
    }
    const opponent = color === 'B' ? 'W' : 'B'
    const threats = candidates.filter(({ x, y }) => isWinningMove(working, x, y, opponent))
    const pool = threats.length ? threats : candidates
    let bestMove = pool[0]
    let bestScore = color === 'B' ? -Infinity : Infinity
    for (const move of pool) {
      working[move.y][move.x] = color
      const score = evaluateBoard(working)
      working[move.y][move.x] = null
      if ((color === 'B' && score > bestScore) || (color === 'W' && score < bestScore)) {
        bestMove = move
        bestScore = score
      }
    }
    pv.push(bestMove)
    working[bestMove.y][bestMove.x] = color
    color = opponent
  }
  return { pv, onlyWinningLine }
}

export function analyzeLocalPosition(board, sideToMove) {
  const score = evaluateBoard(board)
  const { pv, onlyWinningLine } = findPrincipalVariation(board, sideToMove)
  return { score, pv, onlyWinningLine }
}

export function rateMove(before, after, move) {
  const beforeChance = move.color === 'B' ? before.winPercent : 100 - before.winPercent
  const afterChance = move.color === 'B' ? after.winPercent : 100 - after.winPercent
  const drop = Math.max(0, beforeChance - afterChance)
  const isBestMove = before.pv?.[0]?.x === move.x && before.pv?.[0]?.y === move.y
  const beforeAdvantage = displayEnginePoints(before.score)
  const afterAdvantage = displayEnginePoints(after.score)
  const beforeMoverAdvantage = move.color === 'B' ? -beforeAdvantage : beforeAdvantage
  const afterMoverAdvantage = move.color === 'B' ? -afterAdvantage : afterAdvantage
  const pointLoss = Math.max(0, beforeMoverAdvantage - afterMoverAdvantage) / 100
  let rating = 'blunder'
  if (Number.isFinite(before.score) && Number.isFinite(after.score)) {
    if (pointLoss <= 0.1) rating = isBestMove ? 'best' : 'excellent'
    else if (pointLoss <= 0.5) rating = 'excellent'
    else if (pointLoss <= 1.5) rating = 'inaccuracy'
    else if (pointLoss <= 3) rating = 'mistake'
  } else {
    if (drop < 2) rating = drop < 0.5 && isBestMove ? 'best' : 'excellent'
    else if (drop < 10) rating = 'inaccuracy'
    else if (drop <= 20) rating = 'mistake'
  }
  if (pointLoss <= 0.1 && drop === 0 && before.onlyWinningLine && isBestMove) rating = 'brilliant'
  if (after.winner === move.color) rating = 'winning'
  return {
    rating,
    drop: Number(drop.toFixed(1)),
    isBestMove,
    pointAdvantage: afterAdvantage,
  }
}

export function rateOpening(position) {
  const score = displayEnginePoints(position.score)
  const distance = Math.abs(score)
  return {
    rating: distance < 50 ? 'opening-balanced' : score > 0 ? 'opening-white' : 'opening-black',
    pointAdvantage: score,
    balanced: distance < 50,
  }
}