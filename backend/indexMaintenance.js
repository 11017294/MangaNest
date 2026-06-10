import fs from 'node:fs'
import path from 'node:path'
import {
  sequelize,
  Comic,
  Chapter,
  Page,
  ReadingProgress,
  ReadingEvent,
  Category,
  FolderMetadata
} from './db.js'
import { listArchiveImages } from './archiveReader.js'
import { scanMangaLibrary } from './mangaScanner.js'
import { normalizeRelativePath, replacePathPrefix } from './pathIndexSync.js'

const naturalCompare = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, {
  numeric: true,
  sensitivity: 'base'
})

const isInsideBase = (targetPath, basePath) => {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(basePath)
  if (process.platform === 'win32') {
    return resolvedTarget.toLowerCase() === resolvedBase.toLowerCase()
      || resolvedTarget.toLowerCase().startsWith(`${resolvedBase.toLowerCase()}${path.sep}`)
  }
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)
}

export const getReferenceBasePath = (value = '') => {
  const normalized = normalizeRelativePath(value)
  const archiveSeparator = normalized.indexOf('#')
  return archiveSeparator >= 0 ? normalized.slice(0, archiveSeparator) : normalized
}

export const libraryReferenceExists = (libraryPath, reference, expectedType = 'any') => {
  const basePath = getReferenceBasePath(reference)
  if (!basePath) return false

  const fullPath = path.resolve(libraryPath, basePath)
  if (!isInsideBase(fullPath, libraryPath)) return false
  if (!fs.existsSync(fullPath)) return false

  const stat = fs.statSync(fullPath)
  if (expectedType === 'folder') return stat.isDirectory()
  if (expectedType === 'file') return stat.isFile()
  return stat.isDirectory() || stat.isFile()
}

const createLibraryReferenceChecker = (libraryPath) => {
  const archiveEntryCache = new Map()

  return async (reference, expectedType = 'any') => {
    const normalizedReference = normalizeRelativePath(reference)
    const archiveSeparator = normalizedReference.indexOf('#')
    if (archiveSeparator < 0) return libraryReferenceExists(libraryPath, normalizedReference, expectedType)

    const archivePath = normalizedReference.slice(0, archiveSeparator)
    const entryName = normalizedReference.slice(archiveSeparator + 1)
    if (!entryName || !libraryReferenceExists(libraryPath, archivePath, 'file')) return false
    if (expectedType === 'folder') return false

    if (!archiveEntryCache.has(archivePath)) {
      const fullArchivePath = path.resolve(libraryPath, archivePath)
      try {
        const entries = await listArchiveImages(fullArchivePath)
        archiveEntryCache.set(archivePath, new Set(entries.map((entry) => normalizeRelativePath(entry.name))))
      } catch {
        archiveEntryCache.set(archivePath, new Set())
      }
    }

    return archiveEntryCache.get(archivePath).has(normalizeRelativePath(entryName))
  }
}

const toPlain = (value) => value?.toJSON ? value.toJSON() : value

const normalizeTitle = (value) => String(value || '').trim().toLowerCase()

const sortedChapters = (comic) => [...(toPlain(comic)?.chapters || [])].sort((left, right) => {
  const leftOrder = Number(left.sortOrder ?? left.number ?? 0)
  const rightOrder = Number(right.sortOrder ?? right.number ?? 0)
  if (leftOrder !== rightOrder) return leftOrder - rightOrder
  return naturalCompare(left.title, right.title)
})

const sortedPages = (chapter) => [...(toPlain(chapter)?.pages || [])].sort((left, right) => {
  const leftIndex = Number(left.pageIndex ?? 0)
  const rightIndex = Number(right.pageIndex ?? 0)
  if (leftIndex !== rightIndex) return leftIndex - rightIndex
  return naturalCompare(left.name, right.name)
})

export const buildComicContentKey = (comic) => {
  const plain = toPlain(comic) || {}
  const chapters = sortedChapters(plain).map((chapter) => {
    const pages = sortedPages(chapter)
    return {
      title: normalizeTitle(chapter.title),
      pageCount: Number(chapter.pageCount ?? pages.length) || 0,
      pages: pages.map((page) => ({
        name: normalizeTitle(page.name || path.basename(getReferenceBasePath(page.filePath || ''))),
        fileSize: Number(page.fileSize || 0) || 0
      }))
    }
  })

  if (!chapters.length) return ''

  return JSON.stringify({
    title: normalizeTitle(plain.title),
    chapters
  })
}

const findMovedComicCandidate = (comicData, candidatesByContentKey, claimedComicIds) => {
  const contentKey = buildComicContentKey(comicData)
  if (!contentKey) return null

  const candidates = (candidatesByContentKey.get(contentKey) || [])
    .filter((comic) => !claimedComicIds.has(comic.id))

  return candidates.length === 1 ? candidates[0] : null
}

const mergeComicBusinessData = async (sourceComic, targetComic, transaction) => {
  if (!sourceComic || !targetComic || sourceComic.id === targetComic.id) return false

  targetComic.favorite = !!targetComic.favorite || !!sourceComic.favorite
  targetComic.readCount = Math.max(Number(targetComic.readCount || 0), Number(sourceComic.readCount || 0))

  const targetLastReadTime = targetComic.lastReadAt ? new Date(targetComic.lastReadAt).getTime() : 0
  const sourceLastReadTime = sourceComic.lastReadAt ? new Date(sourceComic.lastReadAt).getTime() : 0
  if (sourceLastReadTime > targetLastReadTime) targetComic.lastReadAt = sourceComic.lastReadAt

  for (const field of ['author', 'description', 'status']) {
    if (!targetComic[field] && sourceComic[field]) targetComic[field] = sourceComic[field]
  }

  await targetComic.save({ transaction })

  const sourceCategoryLinks = await sequelize.models.ComicCategory.findAll({
    where: { comicId: sourceComic.id },
    transaction
  })
  for (const link of sourceCategoryLinks) {
    await sequelize.models.ComicCategory.findOrCreate({
      where: {
        comicId: targetComic.id,
        categoryId: link.categoryId
      },
      defaults: {
        comicId: targetComic.id,
        categoryId: link.categoryId
      },
      transaction
    })
  }

  const sourceProgress = await ReadingProgress.findOne({
    where: { comicId: sourceComic.id },
    transaction
  })
  if (sourceProgress) {
    const targetProgress = await ReadingProgress.findOne({
      where: { comicId: targetComic.id },
      transaction
    })
    const shouldCopyProgress = !targetProgress
      || new Date(sourceProgress.updatedAt || 0).getTime() > new Date(targetProgress.updatedAt || 0).getTime()

    if (shouldCopyProgress) {
      const sourceChapter = await Chapter.findByPk(sourceProgress.chapterId, { transaction })
      const targetChapters = await Chapter.findAll({
        where: { comicId: targetComic.id },
        order: [['sortOrder', 'ASC'], ['id', 'ASC']],
        transaction
      })
      const targetChapter = targetChapters.find((chapter) => {
        return sourceChapter
          && normalizeTitle(chapter.title) === normalizeTitle(sourceChapter.title)
          && Number(chapter.sortOrder || 0) === Number(sourceChapter.sortOrder || 0)
      }) || targetChapters.find((chapter) => {
        return sourceChapter && Number(chapter.sortOrder || 0) === Number(sourceChapter.sortOrder || 0)
      }) || targetChapters[0]

      if (targetChapter) {
        const values = {
          comicId: targetComic.id,
          chapterId: targetChapter.id,
          pageIndex: Math.min(
            Number(sourceProgress.pageIndex || 0),
            Math.max(0, Number(targetChapter.pageCount || 0) - 1)
          ),
          scrollOffset: Number(sourceProgress.scrollOffset || 0)
        }
        if (targetProgress) {
          Object.assign(targetProgress, values)
          await targetProgress.save({ transaction })
        } else {
          await ReadingProgress.create(values, { transaction })
        }
      }
    }
  }

  await destroyComicIndexes([sourceComic.id], transaction)
  return true
}

const resolveNextCoverPath = async (referenceExists, currentCoverPath, oldSourcePath, newSourcePath, scannedCoverPath) => {
  const normalizedCurrentCover = normalizeRelativePath(currentCoverPath)
  if (normalizedCurrentCover) {
    const movedCoverPath = oldSourcePath && newSourcePath
      ? replacePathPrefix(normalizedCurrentCover, oldSourcePath, newSourcePath)
      : normalizedCurrentCover

    if (await referenceExists(movedCoverPath, 'file')) return movedCoverPath
    if (await referenceExists(normalizedCurrentCover, 'file')) return normalizedCurrentCover
  }

  return scannedCoverPath || null
}

const findMatchingChapter = (existingChapters, usedChapterIds, chapterData, oldSourcePath, newSourcePath) => {
  const targetPath = normalizeRelativePath(chapterData.path)
  const availableChapters = existingChapters.filter((chapter) => !usedChapterIds.has(chapter.id))

  return availableChapters.find((chapter) => normalizeRelativePath(chapter.path) === targetPath)
    || availableChapters.find((chapter) => {
      if (!oldSourcePath || oldSourcePath === newSourcePath) return false
      return replacePathPrefix(chapter.path, oldSourcePath, newSourcePath) === targetPath
    })
    || availableChapters.find((chapter) => (
      normalizeTitle(chapter.title) === normalizeTitle(chapterData.title)
      && Number(chapter.pageCount || 0) === Number(chapterData.pageCount || 0)
    ))
}

const repairProgressBeforeChapterRemoval = async (comicId, removedChapterIds, fallbackChapterId, transaction) => {
  if (!removedChapterIds.length) return

  const progress = await ReadingProgress.findOne({ where: { comicId }, transaction })
  if (!progress || !removedChapterIds.includes(progress.chapterId)) return

  if (!fallbackChapterId) {
    await progress.destroy({ transaction })
    return
  }

  progress.chapterId = fallbackChapterId
  progress.pageIndex = 0
  progress.scrollOffset = 0
  await progress.save({ transaction })
}

const repairProgressForComic = async (comicId, transaction) => {
  const progress = await ReadingProgress.findOne({ where: { comicId }, transaction })
  if (!progress) return

  const chapter = await Chapter.findOne({ where: { id: progress.chapterId, comicId }, transaction })
  if (!chapter) {
    const firstChapter = await Chapter.findOne({
      where: { comicId },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']],
      transaction
    })
    if (!firstChapter) {
      await progress.destroy({ transaction })
      return
    }
    progress.chapterId = firstChapter.id
    progress.pageIndex = 0
    progress.scrollOffset = 0
    await progress.save({ transaction })
    return
  }

  const maxPageIndex = Math.max(0, Number(chapter.pageCount || 0) - 1)
  if (progress.pageIndex > maxPageIndex) {
    progress.pageIndex = maxPageIndex
    await progress.save({ transaction })
  }
}

const syncScannedComicChapters = async (comic, comicData, oldSourcePath, transaction) => {
  const Op = sequelize.Sequelize.Op
  const existingChapters = await Chapter.findAll({
    where: { comicId: comic.id },
    order: [['sortOrder', 'ASC'], ['id', 'ASC']],
    transaction
  })
  const usedChapterIds = new Set()
  let firstChapterId = null
  let syncedPageCount = 0

  for (const chapterData of comicData.chapters) {
    let chapter = findMatchingChapter(existingChapters, usedChapterIds, chapterData, oldSourcePath, comicData.sourcePath)
    if (!chapter) {
      chapter = await Chapter.create({
        comicId: comic.id,
        title: chapterData.title,
        number: chapterData.number,
        path: chapterData.path,
        type: chapterData.type,
        pageCount: chapterData.pageCount,
        sortOrder: chapterData.sortOrder
      }, { transaction })
    } else {
      chapter.title = chapterData.title
      chapter.number = chapterData.number
      chapter.path = chapterData.path
      chapter.type = chapterData.type
      chapter.pageCount = chapterData.pageCount
      chapter.sortOrder = chapterData.sortOrder
      await chapter.save({ transaction })
    }

    await Page.destroy({ where: { chapterId: chapter.id }, transaction })
    const pages = chapterData.pages.map((page) => ({
      chapterId: chapter.id,
      pageIndex: page.pageIndex,
      name: page.name,
      filePath: page.filePath,
      width: page.width,
      height: page.height,
      fileSize: page.fileSize
    }))
    if (pages.length) await Page.bulkCreate(pages, { transaction })

    usedChapterIds.add(chapter.id)
    if (!firstChapterId) firstChapterId = chapter.id
    syncedPageCount += pages.length
  }

  const removedChapterIds = existingChapters
    .filter((chapter) => !usedChapterIds.has(chapter.id))
    .map((chapter) => chapter.id)

  if (removedChapterIds.length) {
    await repairProgressBeforeChapterRemoval(comic.id, removedChapterIds, firstChapterId, transaction)
    await ReadingEvent.destroy({ where: { chapterId: { [Op.in]: removedChapterIds } }, transaction })
    await Page.destroy({ where: { chapterId: { [Op.in]: removedChapterIds } }, transaction })
    await Chapter.destroy({ where: { id: { [Op.in]: removedChapterIds } }, transaction })
  }

  await repairProgressForComic(comic.id, transaction)

  return {
    chapters: comicData.chapters.length,
    pages: syncedPageCount,
    removedChapters: removedChapterIds.length
  }
}

const syncScannedComic = async (referenceExists, comic, comicData, transaction) => {
  const oldSourcePath = normalizeRelativePath(comic.sourcePath)
  const newSourcePath = normalizeRelativePath(comicData.sourcePath)

  comic.title = comicData.title
  comic.sourcePath = newSourcePath
  comic.sortOrder = comicData.sortOrder
  comic.coverPath = await resolveNextCoverPath(
    referenceExists,
    comic.coverPath,
    oldSourcePath,
    newSourcePath,
    comicData.coverPath
  )
  await comic.save({ transaction })

  return syncScannedComicChapters(comic, comicData, oldSourcePath, transaction)
}

const createScannedComic = async (comicData, transaction) => {
  return Comic.create({
    title: comicData.title,
    coverPath: comicData.coverPath,
    sourcePath: comicData.sourcePath,
    sortOrder: comicData.sortOrder
  }, { transaction })
}

export const rebuildMangaIndex = async (libraryPath, options = {}) => {
  const root = path.resolve(libraryPath)
  const referenceExists = createLibraryReferenceChecker(root)
  const result = await scanMangaLibrary(root, options)
  const existingComics = await Comic.findAll({
    include: [{
      model: Chapter,
      as: 'chapters',
      required: false,
      include: [{ model: Page, as: 'pages', required: false }]
    }]
  })
  const existingBySourcePath = new Map(existingComics.map((comic) => [
    normalizeRelativePath(comic.sourcePath),
    comic
  ]))
  const movedCandidatesByContentKey = new Map()

  for (const comic of existingComics) {
    if (libraryReferenceExists(root, comic.sourcePath, 'folder')) continue
    const contentKey = buildComicContentKey(comic)
    if (!contentKey) continue
    if (!movedCandidatesByContentKey.has(contentKey)) movedCandidatesByContentKey.set(contentKey, [])
    movedCandidatesByContentKey.get(contentKey).push(comic)
  }

  const stats = {
    scannedComics: result.comics.length,
    createdComics: 0,
    updatedComics: 0,
    movedComics: 0,
    mergedStaleComics: 0,
    syncedChapters: 0,
    syncedPages: 0,
    removedChapters: 0
  }
  const claimedComicIds = new Set()

  await sequelize.transaction(async (transaction) => {
    for (const comicData of result.comics) {
      const sourcePath = normalizeRelativePath(comicData.sourcePath)
      let comic = existingBySourcePath.get(sourcePath)
      let staleMovedComic = null
      let moved = false

      if (comic && claimedComicIds.has(comic.id)) comic = null
      staleMovedComic = findMovedComicCandidate(comicData, movedCandidatesByContentKey, claimedComicIds)
      if (!comic) {
        comic = staleMovedComic
        moved = !!comic
      }

      if (!comic) {
        comic = await createScannedComic(comicData, transaction)
        stats.createdComics += 1
      } else {
        stats.updatedComics += 1
        if (moved) stats.movedComics += 1
      }

      claimedComicIds.add(comic.id)
      const chapterStats = await syncScannedComic(referenceExists, comic, comicData, transaction)
      if (staleMovedComic && staleMovedComic.id !== comic.id) {
        const merged = await mergeComicBusinessData(staleMovedComic, comic, transaction)
        if (merged) {
          claimedComicIds.add(staleMovedComic.id)
          stats.mergedStaleComics += 1
        }
      }
      stats.syncedChapters += chapterStats.chapters
      stats.syncedPages += chapterStats.pages
      stats.removedChapters += chapterStats.removedChapters
    }
  })

  return {
    ...result,
    index: stats
  }
}

const summarizeItems = (items) => ({
  count: items.length,
  items
})

export const inspectMangaIndex = async (libraryPath) => {
  const root = path.resolve(libraryPath)
  const referenceExists = createLibraryReferenceChecker(root)
  const [comics, chapters, pages, folderMetadataRows, progressRows, categories, categoryLinks] = await Promise.all([
    Comic.findAll({ attributes: ['id', 'title', 'sourcePath', 'coverPath'] }),
    Chapter.findAll({ attributes: ['id', 'comicId', 'title', 'path', 'type', 'pageCount'] }),
    Page.findAll({ attributes: ['id', 'chapterId', 'name', 'filePath'] }),
    FolderMetadata.findAll(),
    ReadingProgress.findAll(),
    Category.findAll({ attributes: ['id'] }),
    sequelize.models.ComicCategory.findAll()
  ])

  const comicIds = new Set(comics.map((comic) => comic.id))
  const categoryIds = new Set(categories.map((category) => category.id))
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]))
  const chapterIds = new Set(chapters.map((chapter) => chapter.id))

  const missingComics = []
  for (const comic of comics) {
    if (await referenceExists(comic.sourcePath, 'folder')) continue
    missingComics.push({
      id: comic.id,
      title: comic.title,
      sourcePath: comic.sourcePath
    })
  }

  const missingComicCovers = []
  for (const comic of comics) {
    if (!comic.coverPath || await referenceExists(comic.coverPath, 'file')) continue
    missingComicCovers.push({
      id: comic.id,
      title: comic.title,
      coverPath: comic.coverPath
    })
  }

  const invalidChapters = []
  for (const chapter of chapters) {
    const expectedType = chapter.type === 'archive' ? 'file' : 'folder'
    if (comicIds.has(chapter.comicId) && await referenceExists(chapter.path, expectedType)) continue
    invalidChapters.push({
      id: chapter.id,
      comicId: chapter.comicId,
      title: chapter.title,
      path: chapter.path,
      type: chapter.type
    })
  }

  const invalidPages = []
  for (const page of pages) {
    if (chapterIds.has(page.chapterId) && await referenceExists(page.filePath, 'file')) continue
    invalidPages.push({
      id: page.id,
      chapterId: page.chapterId,
      name: page.name,
      filePath: page.filePath
    })
  }

  const invalidFolderMetadata = []
  for (const metadata of folderMetadataRows) {
    if (!metadata.path || await referenceExists(metadata.path, 'folder')) continue
    invalidFolderMetadata.push({
      path: metadata.path,
      coverImage: metadata.coverImage
    })
  }

  const invalidFolderCovers = []
  for (const metadata of folderMetadataRows) {
    if (!metadata.coverImage || await referenceExists(metadata.coverImage, 'file')) continue
    invalidFolderCovers.push({
      path: metadata.path,
      coverImage: metadata.coverImage
    })
  }

  const invalidProgress = progressRows
    .filter((progress) => {
      const chapter = chapterById.get(progress.chapterId)
      return !comicIds.has(progress.comicId)
        || !chapter
        || chapter.comicId !== progress.comicId
    })
    .map((progress) => ({
      id: progress.id,
      comicId: progress.comicId,
      chapterId: progress.chapterId
    }))

  const invalidCategoryLinks = categoryLinks
    .filter((link) => !comicIds.has(link.comicId) || !categoryIds.has(link.categoryId))
    .map((link) => ({
      comicId: link.comicId,
      categoryId: link.categoryId
    }))

  const totalIssues = missingComics.length
    + missingComicCovers.length
    + invalidChapters.length
    + invalidPages.length
    + invalidFolderMetadata.length
    + invalidFolderCovers.length
    + invalidProgress.length
    + invalidCategoryLinks.length

  return {
    libraryPath: root,
    summary: {
      totalIssues,
      missingComics: missingComics.length,
      missingComicCovers: missingComicCovers.length,
      invalidChapters: invalidChapters.length,
      invalidPages: invalidPages.length,
      invalidFolderMetadata: invalidFolderMetadata.length,
      invalidFolderCovers: invalidFolderCovers.length,
      invalidProgress: invalidProgress.length,
      invalidCategoryLinks: invalidCategoryLinks.length
    },
    comics: {
      missingSource: summarizeItems(missingComics),
      missingCover: summarizeItems(missingComicCovers)
    },
    chapters: {
      invalid: summarizeItems(invalidChapters)
    },
    pages: {
      invalid: summarizeItems(invalidPages)
    },
    folderMetadata: {
      invalidPath: summarizeItems(invalidFolderMetadata),
      invalidCover: summarizeItems(invalidFolderCovers)
    },
    readingProgress: {
      invalid: summarizeItems(invalidProgress)
    },
    categoryLinks: {
      invalid: summarizeItems(invalidCategoryLinks)
    }
  }
}

const destroyComicIndexes = async (comicIds, transaction) => {
  const Op = sequelize.Sequelize.Op
  if (!comicIds.length) return 0

  const chapters = await Chapter.findAll({
    where: { comicId: { [Op.in]: comicIds } },
    attributes: ['id'],
    transaction
  })
  const chapterIds = chapters.map((chapter) => chapter.id)

  await ReadingProgress.destroy({ where: { comicId: { [Op.in]: comicIds } }, transaction })
  await ReadingEvent.destroy({ where: { comicId: { [Op.in]: comicIds } }, transaction })
  await sequelize.models.ComicCategory.destroy({ where: { comicId: { [Op.in]: comicIds } }, transaction })
  if (chapterIds.length) await Page.destroy({ where: { chapterId: { [Op.in]: chapterIds } }, transaction })
  await Chapter.destroy({ where: { comicId: { [Op.in]: comicIds } }, transaction })
  await Comic.destroy({ where: { id: { [Op.in]: comicIds } }, transaction })

  return comicIds.length
}

export const cleanupInvalidMangaIndex = async (libraryPath) => {
  const Op = sequelize.Sequelize.Op
  const report = await inspectMangaIndex(libraryPath)
  const missingComicIds = report.comics.missingSource.items.map((comic) => comic.id)
  const missingComicIdSet = new Set(missingComicIds)
  const invalidChapterIds = report.chapters.invalid.items
    .filter((chapter) => !missingComicIdSet.has(chapter.comicId))
    .map((chapter) => chapter.id)
  const invalidChapterIdSet = new Set(invalidChapterIds)
  const invalidPageIds = report.pages.invalid.items
    .filter((page) => !invalidChapterIdSet.has(page.chapterId))
    .map((page) => page.id)
  const invalidCoverComicIds = report.comics.missingCover.items
    .filter((comic) => !missingComicIdSet.has(comic.id))
    .map((comic) => comic.id)
  const invalidFolderMetadataPaths = report.folderMetadata.invalidPath.items.map((metadata) => metadata.path)
  const invalidFolderCoverPaths = report.folderMetadata.invalidCover.items
    .filter((metadata) => !invalidFolderMetadataPaths.includes(metadata.path))
    .map((metadata) => metadata.path)
  const invalidProgressIds = report.readingProgress.invalid.items.map((progress) => progress.id)
  const invalidCategoryLinks = report.categoryLinks.invalid.items

  const cleaned = {
    comics: 0,
    chapters: 0,
    pages: 0,
    comicCovers: 0,
    folderMetadata: 0,
    folderCovers: 0,
    readingProgress: 0,
    categoryLinks: 0
  }

  await sequelize.transaction(async (transaction) => {
    cleaned.comics = await destroyComicIndexes(missingComicIds, transaction)

    if (invalidCoverComicIds.length) {
      const [count] = await Comic.update(
        { coverPath: null },
        { where: { id: { [Op.in]: invalidCoverComicIds } }, transaction }
      )
      cleaned.comicCovers = count
    }

    if (invalidChapterIds.length) {
      const chapters = await Chapter.findAll({
        where: { id: { [Op.in]: invalidChapterIds } },
        attributes: ['id', 'comicId'],
        transaction
      })
      const affectedComicIds = [...new Set(chapters.map((chapter) => chapter.comicId))]
      for (const comicId of affectedComicIds) {
        const fallbackChapter = await Chapter.findOne({
          where: {
            comicId,
            id: { [Op.notIn]: invalidChapterIds }
          },
          order: [['sortOrder', 'ASC'], ['id', 'ASC']],
          transaction
        })
        await repairProgressBeforeChapterRemoval(
          comicId,
          invalidChapterIds,
          fallbackChapter?.id || null,
          transaction
        )
      }
      await ReadingEvent.destroy({ where: { chapterId: { [Op.in]: invalidChapterIds } }, transaction })
      await Page.destroy({ where: { chapterId: { [Op.in]: invalidChapterIds } }, transaction })
      cleaned.chapters = await Chapter.destroy({ where: { id: { [Op.in]: invalidChapterIds } }, transaction })
    }

    if (invalidPageIds.length) {
      const pages = await Page.findAll({
        where: { id: { [Op.in]: invalidPageIds } },
        attributes: ['id', 'chapterId'],
        transaction
      })
      const affectedChapterIds = [...new Set(pages.map((page) => page.chapterId))]
      cleaned.pages = await Page.destroy({ where: { id: { [Op.in]: invalidPageIds } }, transaction })

      for (const chapterId of affectedChapterIds) {
        const chapter = await Chapter.findByPk(chapterId, { transaction })
        if (!chapter) continue
        chapter.pageCount = await Page.count({ where: { chapterId }, transaction })
        await chapter.save({ transaction })
        await repairProgressForComic(chapter.comicId, transaction)
      }
    }

    if (invalidFolderMetadataPaths.length) {
      cleaned.folderMetadata = await FolderMetadata.destroy({
        where: { path: { [Op.in]: invalidFolderMetadataPaths } },
        transaction
      })
    }

    if (invalidFolderCoverPaths.length) {
      const [count] = await FolderMetadata.update(
        { coverImage: null },
        { where: { path: { [Op.in]: invalidFolderCoverPaths } }, transaction }
      )
      cleaned.folderCovers = count
    }

    if (invalidProgressIds.length) {
      cleaned.readingProgress = await ReadingProgress.destroy({
        where: { id: { [Op.in]: invalidProgressIds } },
        transaction
      })
    }

    for (const link of invalidCategoryLinks) {
      await sequelize.models.ComicCategory.destroy({
        where: {
          comicId: link.comicId,
          categoryId: link.categoryId
        },
        transaction
      })
      cleaned.categoryLinks += 1
    }
  })

  return {
    checked: report.summary,
    cleaned
  }
}
