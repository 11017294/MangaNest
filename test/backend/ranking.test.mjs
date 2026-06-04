import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRankingScore, sortRankedComics } from '../../backend/ranking.js'

const now = new Date('2026-06-02T00:00:00.000Z')

test('calculateRankingScore gives favorite a strong preference without using favorite time', () => {
  const favorite = calculateRankingScore({ readCount: 0, favorite: true, lastReadAt: null }, now)
  const notFavorite = calculateRankingScore({ readCount: 2, favorite: false, lastReadAt: null }, now)

  assert.ok(favorite > notFavorite)
})

test('calculateRankingScore uses logarithmic read count growth', () => {
  const oneRead = calculateRankingScore({ readCount: 1, favorite: false, lastReadAt: null }, now)
  const tenReads = calculateRankingScore({ readCount: 10, favorite: false, lastReadAt: null }, now)
  const hundredReads = calculateRankingScore({ readCount: 100, favorite: false, lastReadAt: null }, now)

  assert.ok(tenReads > oneRead)
  assert.ok(hundredReads > tenReads)
  assert.ok((hundredReads - tenReads) < (tenReads - oneRead) * 2)
})

test('calculateRankingScore gives recent reading a decaying boost', () => {
  const recent = calculateRankingScore({
    readCount: 1,
    favorite: false,
    lastReadAt: '2026-06-01T00:00:00.000Z'
  }, now)
  const old = calculateRankingScore({
    readCount: 1,
    favorite: false,
    lastReadAt: '2026-04-01T00:00:00.000Z'
  }, now)

  assert.ok(recent > old)
})

test('sortRankedComics falls back to last read count and title', () => {
  const comics = [
    { title: 'B', readCount: 2, favorite: false, lastReadAt: null },
    { title: 'A', readCount: 2, favorite: false, lastReadAt: null }
  ]

  assert.deepEqual(sortRankedComics(comics, now).map((comic) => comic.title), ['A', 'B'])
})
