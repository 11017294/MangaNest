import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { listArchiveImages, readArchiveEntryBuffer } from '../../backend/archiveReader.js'

const createZip = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbz-test-'))
  const source = path.join(dir, 'source')
  fs.mkdirSync(path.join(source, 'chapter'), { recursive: true })
  fs.writeFileSync(path.join(source, 'chapter', '002.jpg'), 'two')
  fs.writeFileSync(path.join(source, 'chapter', '001.jpg'), 'one')
  fs.writeFileSync(path.join(source, 'chapter', 'note.txt'), 'note')
  const archive = path.join(dir, 'chapter.cbz')
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${source}\\*' -DestinationPath '${archive}'`
  ])
  return archive
}

test('listArchiveImages lists archive images in natural order', async () => {
  const archive = createZip()
  const images = await listArchiveImages(archive)

  assert.deepEqual(images.map((image) => image.name), ['chapter/001.jpg', 'chapter/002.jpg'])
})

test('readArchiveEntryBuffer reads a single entry', async () => {
  const archive = createZip()
  const buffer = await readArchiveEntryBuffer(archive, 'chapter/001.jpg')

  assert.equal(buffer.toString(), 'one')
})
