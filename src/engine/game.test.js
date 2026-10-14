import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGameText } from './game.js'

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

test('rejects files with no valid moves', () => {
  assert.throws(() => parseGameText('not a game'), /Nepodařilo se najít tahy/)
})