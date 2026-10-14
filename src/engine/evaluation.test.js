import test from 'node:test'
import assert from 'node:assert/strict'
import { rateMove, winProbability } from './evaluation.js'

test('converts scores to bounded win probabilities around 50 percent', () => {
  assert.equal(winProbability(0), 50)
  assert.ok(winProbability(10000) < 100)
  assert.ok(winProbability(-10000) > 0)
})

test('rates a strong move in the mover perspective', () => {
  const rating = rateMove(
    { winPercent: 50, pv: [{ x: 7, y: 7 }], onlyWinningLine: false },
    { winPercent: 55 },
    { x: 7, y: 7, color: 'B' },
  )
  assert.equal(rating.rating, 'best')
  assert.equal(rating.drop, 0)
})

test('reserves brilliant for a zero-drop unique winning line', () => {
  const before = { winPercent: 70, pv: [{ x: 7, y: 7 }], onlyWinningLine: true }
  const brilliant = rateMove(before, { winPercent: 70 }, { x: 7, y: 7, color: 'B' })
  const nonZeroDrop = rateMove(before, { winPercent: 69.9 }, { x: 7, y: 7, color: 'B' })
  assert.equal(brilliant.rating, 'brilliant')
  assert.equal(nonZeroDrop.rating, 'best')
})

test('keeps an exact 20 percent drop in the mistake band', () => {
  const before = { winPercent: 70 }
  assert.equal(rateMove(before, { winPercent: 50 }, { x: 1, y: 1, color: 'B' }).rating, 'mistake')
  assert.equal(rateMove(before, { winPercent: 49.9 }, { x: 1, y: 1, color: 'B' }).rating, 'blunder')
})