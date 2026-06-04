import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReaderWindow, estimatePageHeight } from '../../../frontend/src/utils/readerWindow.js'

test('estimatePageHeight uses page aspect ratio and viewport width', () => {
  assert.equal(estimatePageHeight({ width: 600, height: 900 }, 300), 450)
})

test('estimatePageHeight falls back to a stable manga page height', () => {
  assert.equal(estimatePageHeight({ width: null, height: null }, 300), 400)
})

test('buildReaderWindow returns visible pages with spacer heights', () => {
  const pages = [
    { id: 1, width: 100, height: 200 },
    { id: 2, width: 100, height: 200 },
    { id: 3, width: 100, height: 200 },
    { id: 4, width: 100, height: 200 }
  ]

  const result = buildReaderWindow({
    pages,
    scrollTop: 650,
    viewportHeight: 300,
    viewportWidth: 200,
    overscan: 0
  })

  assert.deepEqual(result.visiblePages.map((page) => page.id), [2, 3])
  assert.equal(result.topSpacer, 400)
  assert.equal(result.bottomSpacer, 400)
})
