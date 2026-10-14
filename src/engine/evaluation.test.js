import test from 'node:test'
import assert from 'node:assert/strict'
import { displayEnginePoints, enginePoints, formatEnginePoints, rateMove, rateOpening, winProbability } from './evaluation.js'

test('converts scores to bounded win probabilities around 50 percent', () => {
  assert.equal(winProbability(0), 50)
  assert.ok(winProbability(10000) < 100)
  assert.ok(winProbability(-10000) > 0)
})

test('uses engine points with white-positive display orientation', () => {
  assert.equal(enginePoints(100), 100)
  assert.equal(displayEnginePoints(250), -250)
  assert.equal(formatEnginePoints(250), '-250')
  assert.equal(formatEnginePoints(-250), '250')
  assert.equal(formatEnginePoints(-29998), 'M1')
  assert.equal(formatEnginePoints(29996), '-M2')
})

test('rates points gained or lost from the mover perspective', () => {
  const blackLoss = rateMove(
    { score: 200, winPercent: 70 },
    { score: 70, winPercent: 60 },
    { x: 1, y: 1, color: 'B' },
  )
  assert.equal(blackLoss.pointAdvantage, -70)

  const whiteGain = rateMove(
    { score: 200, winPercent: 70 },
    { score: 70, winPercent: 60 },
    { x: 1, y: 1, color: 'W' },
  )
  assert.equal(whiteGain.pointAdvantage, -70)
})

test('labels an exact-five terminal move as winning', () => {
  const result = rateMove(
    { score: 0, winPercent: 50 },
    { score: 10000, winPercent: 100, winner: 'B' },
    { x: 4, y: 7, color: 'B' },
  )
  assert.equal(result.rating, 'winning')
  assert.equal(result.pointAdvantage, -10000)
})

test('does not label an unrecommended move best when win chances are saturated', () => {
  const rating = rateMove(
    { score: 400, winPercent: 100, pv: [{ x: 9, y: 4 }] },
    { score: 1200, winPercent: 100 },
    { x: 11, y: 11, color: 'W' },
  )
  assert.equal(rating.rating, 'blunder')
  assert.equal(rating.pointAdvantage, -1200)
})

test('rates opening balance around zero engine points', () => {
  assert.equal(rateOpening({ score: 40 }).rating, 'opening-balanced')
  assert.equal(rateOpening({ score: -500 }).rating, 'opening-white')
  assert.equal(rateOpening({ score: 500 }).rating, 'opening-black')
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