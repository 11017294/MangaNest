import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { scanMangaLibrary } from '../../backend/mangaScanner.js'

const makeTempLibrary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'manga-library-'))

const writeFile = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, 'x')
}

test('scanMangaLibrary discovers comics chapters pages and cover images', async () => {
  const root = makeTempLibrary()
  writeFile(path.join(root, 'Comic A', 'cover.jpg'))
  writeFile(path.join(root, 'Comic A', '第2话', '002.jpg'))
  writeFile(path.join(root, 'Comic A', '第2话', '001.jpg'))
  writeFile(path.join(root, 'Comic A', '第10话', '001.webp'))
  writeFile(path.join(root, 'Comic A', '第10话', 'note.txt'))

  const result = await scanMangaLibrary(root)

  assert.equal(result.comics.length, 1)
  assert.equal(result.comics[0].title, 'Comic A')
  assert.equal(result.comics[0].coverPath, 'Comic A/cover.jpg')
  assert.deepEqual(result.comics[0].chapters.map((chapter) => chapter.title), ['第2话', '第10话'])
  assert.deepEqual(result.comics[0].chapters[0].pages.map((page) => page.name), ['001.jpg', '002.jpg'])
  assert.equal(result.comics[0].chapters[1].pages.length, 1)
})

test('scanMangaLibrary falls back to first chapter page when cover is missing', async () => {
  const root = makeTempLibrary()
  writeFile(path.join(root, 'Comic B', '001', '0001.png'))

  const result = await scanMangaLibrary(root)

  assert.equal(result.comics[0].coverPath, 'Comic B/001/0001.png')
})

test('scanMangaLibrary treats a comic folder with direct images as a single chapter comic', async () => {
  const root = makeTempLibrary()
  writeFile(path.join(root, 'chapter_04', '41038.webp'))
  writeFile(path.join(root, 'chapter_04', '41039.webp'))
  writeFile(path.join(root, 'chapter_05', '41058.webp'))
  writeFile(path.join(root, 'note.txt'))

  const result = await scanMangaLibrary(root)

  assert.equal(result.comics.length, 2)
  assert.deepEqual(result.comics.map((comic) => comic.title), ['chapter_04', 'chapter_05'])
  assert.deepEqual(result.comics[0].chapters.map((chapter) => chapter.title), ['默认章节'])
  assert.deepEqual(result.comics[0].chapters[0].pages.map((page) => page.name), ['41038.webp', '41039.webp'])
  assert.equal(result.comics[0].coverPath, 'chapter_04/41038.webp')
})

test('scanMangaLibrary includes page dimensions when they are readable', async () => {
  const root = makeTempLibrary()
  writeFile(path.join(root, 'Comic C', '001', '0001.png'))
  fs.writeFileSync(path.join(root, 'Comic C', '001', '0001.png'), Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x02, 0x58,
    0x00, 0x00, 0x03, 0x84,
    0x08, 0x02, 0x00, 0x00, 0x00
  ]))

  const result = await scanMangaLibrary(root)

  assert.equal(result.comics[0].chapters[0].pages[0].width, 600)
  assert.equal(result.comics[0].chapters[0].pages[0].height, 900)
})

test('scanMangaLibrary discovers CBZ archive chapters', async () => {
  const root = makeTempLibrary()
  const source = path.join(root, 'Comic D', 'cbz-source')
  fs.mkdirSync(source, { recursive: true })
  fs.writeFileSync(path.join(source, '0001.png'), Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x01, 0x2c,
    0x00, 0x00, 0x01, 0x90,
    0x08, 0x02, 0x00, 0x00, 0x00
  ]))
  execFileSync('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${source}\\*' -DestinationPath '${path.join(root, 'Comic D', '001.cbz')}'`
  ])
  fs.rmSync(source, { recursive: true, force: true })

  const result = await scanMangaLibrary(root)

  assert.equal(result.comics[0].chapters[0].type, 'archive')
  assert.equal(result.comics[0].chapters[0].pages[0].filePath, 'Comic D/001.cbz#0001.png')
  assert.equal(result.comics[0].chapters[0].pages[0].width, 300)
  assert.equal(result.comics[0].chapters[0].pages[0].height, 400)
})

test('scanMangaLibrary returns an empty library when the root does not exist', async () => {
  const result = await scanMangaLibrary(path.join(os.tmpdir(), 'missing-manga-library-root'))

  assert.deepEqual(result, { comics: [] })
})
