const BOARD_SIZE = 15

function readSgfNode(source, state) {
  const properties = []
  while (state.index < source.length) {
    while (/\s/.test(source[state.index] ?? '')) state.index += 1
    const keyMatch = source.slice(state.index).match(/^[A-Za-z]+/)
    if (!keyMatch) break
    const key = keyMatch[0].toUpperCase()
    state.index += keyMatch[0].length
    const values = []
    while (source[state.index] === '[') {
      state.index += 1
      let value = ''
      while (state.index < source.length && source[state.index] !== ']') {
        if (source[state.index] === '\\' && state.index + 1 < source.length) state.index += 1
        value += source[state.index]
        state.index += 1
      }
      if (source[state.index] === ']') state.index += 1
      values.push(value)
    }
    properties.push([key, values])
  }
  return properties
}

function readSgfTree(source, state) {
  while (/\s/.test(source[state.index] ?? '')) state.index += 1
  if (source[state.index] !== '(') return []
  state.index += 1
  const sequence = []
  while (state.index < source.length) {
    while (/\s/.test(source[state.index] ?? '')) state.index += 1
    if (source[state.index] === ';') {
      state.index += 1
      sequence.push(readSgfNode(source, state))
    } else {
      break
    }
  }
  let firstVariation = []
  while (state.index < source.length && source[state.index] === '(') {
    const variation = readSgfTree(source, state)
    if (firstVariation.length === 0) firstVariation = variation
    while (/\s/.test(source[state.index] ?? '')) state.index += 1
  }
  if (source[state.index] === ')') state.index += 1
  return [...sequence, ...firstVariation]
}

function parseSgf(source) {
  const root = readSgfTree(source, { index: 0 })
  const moves = []
  for (const properties of root) {
    for (const [key, values] of properties) {
      const color = key === 'B' || key === 'AB' ? 'B' : key === 'W' || key === 'AW' ? 'W' : null
      if (!color) continue
      for (const value of values) {
        if (!/^[a-o]{2}$/i.test(value)) continue
        moves.push({ x: value.toLowerCase().charCodeAt(0) - 97, y: value.toLowerCase().charCodeAt(1) - 97, color })
      }
    }
  }
  return moves
}

function parseCoordinateText(source) {
  const moves = []
  const linePattern = /^\s*(?:([BWbw])\s*[: ]\s*)?(\d{1,2})\s*,\s*(\d{1,2})(?:\s*,\s*([12]))?\s*$/gm
  for (const match of source.matchAll(linePattern)) {
    const x = Number(match[2])
    const y = Number(match[3])
    if (x >= BOARD_SIZE || y >= BOARD_SIZE) continue
    const color = match[1]?.toUpperCase() ?? (match[4] ? (match[4] === '1' ? 'B' : 'W') : moves.length % 2 === 0 ? 'B' : 'W')
    moves.push({ x, y, color })
  }
  return moves
}

export function parseGameText(source) {
  const text = source.replace(/^\uFEFF/, '').trim()
  if (!text) throw new Error('Soubor neobsahuje žádné tahy.')
  const moves = /\(\s*;/.test(text) ? parseSgf(text) : parseCoordinateText(text)
  const seen = new Set()
  const validMoves = moves.filter(({ x, y }) => {
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return false
    const key = `${x},${y}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (validMoves.length === 0) throw new Error('Nepodařilo se najít tahy v SGF ani v souřadnicích x,y.')
  return validMoves
}