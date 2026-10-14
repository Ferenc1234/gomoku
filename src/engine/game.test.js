import test from 'node:test'
import assert from 'node:assert/strict'
import { findWinningLine, parseGameText } from './game.js'

test('parses SGF moves and follows only the first variation', () => {
  const moves = parseGameText('(;GM[40]SZ[15];B[hh];W[gh](;B[ig])(;B[aa]))')
  assert.deepEqual(moves, [
    { x: 7, y: 7, color: 'B' },
    { x: 6, y: 7, color: 'W' },
    { x: 8, y: 6, color: 'B' },
  ])
})

test('parses Piskvork coordinates and explicit colors', () => {
  const moves = parseGameText('7,7,1\n6,7,2\nB 8,6')
  assert.deepEqual(moves, [
    { x: 7, y: 7, color: 'B' },
    { x: 6, y: 7, color: 'W' },
    { x: 8, y: 6, color: 'B' },
  ])
})

test('parses compact coordinates using board row labels', () => {
  const moves = parseGameText('g7j11k7g10i5')
  assert.deepEqual(moves, [
    { x: 6, y: 8, color: 'B' },
    { x: 9, y: 4, color: 'W' },
    { x: 10, y: 8, color: 'B' },
    { x: 6, y: 5, color: 'W' },
    { x: 8, y: 10, color: 'B' },
  ])
})

test('rejects files with no valid moves', () => {
  assert.throws(() => parseGameText('not a game'), /Nepodařilo se najít tahy/)
})

test('detects exactly five consecutive stones, but not an overline', () => {
  const makeLineMoves = (length) => Array.from({ length }, (_, x) => [
    { x, y: 7, color: 'B' },
    { x: x * 2, y: 0, color: 'W' },
  ]).flat()

  const win = findWinningLine(makeLineMoves(5))
  assert.equal(win.color, 'B')
  assert.deepEqual(win.line, Array.from({ length: 5 }, (_, x) => ({ x, y: 7 })))
  assert.equal(findWinningLine(makeLineMoves(6)), null)
})