import fs from 'node:fs'
import path from 'node:path'
import { readImageDimensions, readImageDimensionsFromBuffer } from './imageDimensions.js'
import { listArchiveImages, readArchiveEntryBuffer } from './archiveReader.js'
import { ARCHIVE_EXTENSIONS, IMAGE_EXTENSIONS } from './imageTypes.js'

const naturalCompare = (a, b) => a.localeCompare(b, undefined, {
  numeric: true,
  sensitivity: 'base'
})

const toRelativePath = (root, fullPath) => path.relative(root, fullPath).replace(/\\/g, '/')

const isImageFile = (entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
const isArchiveFile = (entry) => entry.isFile() && ARCHIVE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
const isCoverImage = (entry) => /^cover\.(jpe?g|png|webp|gif|bmp)$/i.test(entry.name)

const safeReadDir = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

const findComicCover = (libraryRoot, comicPath, chapters) => {
  const entries = safeReadDir(comicPath)
  const cover = entries
    .filter(isImageFile)
    .find(isCoverImage)

  if (cover) {
    return toRelativePath(libraryRoot, path.join(comicPath, cover.name))
  }

  return chapters[0]?.pages[0]?.filePath || null
}

const scanPages = (libraryRoot, chapterPath) => safeReadDir(chapterPath)
  .filter((entry) => isImageFile(entry) && !isCoverImage(entry))
  .sort((a, b) => naturalCompare(a.name, b.name))
  .map((entry, pageIndex) => {
    const fullPath = path.join(chapterPath, entry.name)
    const stat = fs.statSync(fullPath)
    const dimensions = readImageDimensions(fullPath)

    return {
      name: entry.name,
      pageIndex,
      filePath: toRelativePath(libraryRoot, fullPath),
      width: dimensions.width,
      height: dimensions.height,
      fileSize: stat.size
    }
  })

const scanChapters = (libraryRoot, comicPath) => safeReadDir(comicPath)
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => naturalCompare(a.name, b.name))
  .map((entry, sortOrder) => {
    const fullPath = path.join(comicPath, entry.name)
    const pages = scanPages(libraryRoot, fullPath)

    return {
      title: entry.name,
      number: sortOrder + 1,
      path: toRelativePath(libraryRoot, fullPath),
      type: 'folder',
      pageCount: pages.length,
      sortOrder,
      pages
    }
  })
  .filter((chapter) => chapter.pageCount > 0)

const scanArchiveChapter = async (libraryRoot, comicPath, entry, sortOrder) => {
  const fullPath = path.join(comicPath, entry.name)
  const archivePath = toRelativePath(libraryRoot, fullPath)
  const images = await listArchiveImages(fullPath)
  const pages = []

  for (let pageIndex = 0; pageIndex < images.length; pageIndex += 1) {
    const image = images[pageIndex]
    let dimensions = { width: null, height: null }
    try {
      const buffer = await readArchiveEntryBuffer(fullPath, image.name)
      dimensions = readImageDimensionsFromBuffer(buffer)
    } catch {}
    pages.push({
      name: path.basename(image.name),
      pageIndex,
      filePath: `${archivePath}#${image.name}`,
      width: dimensions.width,
      height: dimensions.height,
      fileSize: image.fileSize
    })
  }

  return {
    title: path.basename(entry.name, path.extname(entry.name)),
    number: sortOrder + 1,
    path: archivePath,
    type: 'archive',
    pageCount: pages.length,
    sortOrder,
    pages
  }
}

const scanArchiveChapters = async (libraryRoot, comicPath, startOrder) => {
  const archives = safeReadDir(comicPath)
    .filter(isArchiveFile)
    .sort((a, b) => naturalCompare(a.name, b.name))

  const chapters = []
  for (let index = 0; index < archives.length; index += 1) {
    const chapter = await scanArchiveChapter(libraryRoot, comicPath, archives[index], startOrder + index)
    if (chapter.pageCount > 0) chapters.push(chapter)
  }
  return chapters
}

const buildComic = async (libraryRoot, comicPath, title, sourcePath, sortOrder) => {
  const folderChapters = scanChapters(libraryRoot, comicPath)
  const directPages = scanPages(libraryRoot, comicPath)
  const directChapter = directPages.length > 0
    ? [{
        title: '默认章节',
        number: 1,
        path: toRelativePath(libraryRoot, comicPath),
        type: 'folder',
        pageCount: directPages.length,
        sortOrder: 0,
        pages: directPages
      }]
    : []
  const archiveChapters = await scanArchiveChapters(libraryRoot, comicPath, folderChapters.length + directChapter.length)
  const chapters = [...directChapter, ...folderChapters, ...archiveChapters].sort((a, b) => naturalCompare(a.title, b.title))
  chapters.forEach((chapter, index) => {
    chapter.sortOrder = index
    chapter.number = index + 1
  })

  return {
    title,
    sourcePath,
    coverPath: findComicCover(libraryRoot, comicPath, chapters),
    sortOrder,
    chapters
  }
}

export const scanMangaLibrary = async (libraryRoot) => {
  const root = path.resolve(libraryRoot)
  if (!fs.existsSync(root)) return { comics: [] }

  const comicEntries = safeReadDir(root)
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => naturalCompare(a.name, b.name))
  const comics = []

  for (let sortOrder = 0; sortOrder < comicEntries.length; sortOrder += 1) {
    const entry = comicEntries[sortOrder]
    const comicPath = path.join(root, entry.name)
    const comic = await buildComic(root, comicPath, entry.name, toRelativePath(root, comicPath), sortOrder)
    if (comic.chapters.length > 0) comics.push(comic)
  }

  return { comics }
}
