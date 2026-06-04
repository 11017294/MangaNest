import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readImageDimensions, readImageDimensionsFromBuffer } from '../../backend/imageDimensions.js'

const tempFile = (name, bytes) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'image-size-'))
  const filePath = path.join(dir, name)
  fs.writeFileSync(filePath, Buffer.from(bytes))
  return filePath
}

test('readImageDimensions reads PNG width and height', () => {
  const filePath = tempFile('page.png', [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x03, 0x20,
    0x00, 0x00, 0x04, 0xb0,
    0x08, 0x02, 0x00, 0x00, 0x00
  ])

  assert.deepEqual(readImageDimensions(filePath), { width: 800, height: 1200 })
})

test('readImageDimensionsFromBuffer reads PNG width and height', () => {
  const buffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x01, 0x90,
    0x00, 0x00, 0x02, 0x58,
    0x08, 0x02, 0x00, 0x00, 0x00
  ])

  assert.deepEqual(readImageDimensionsFromBuffer(buffer), { width: 400, height: 600 })
})

test('readImageDimensions reads GIF width and height', () => {
  const filePath = tempFile('page.gif', [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    0x20, 0x03,
    0xb0, 0x04
  ])

  assert.deepEqual(readImageDimensions(filePath), { width: 800, height: 1200 })
})

test('readImageDimensions returns null dimensions for unknown files', () => {
  const filePath = tempFile('page.txt', [0x00, 0x01, 0x02])

  assert.deepEqual(readImageDimensions(filePath), { width: null, height: null })
})
