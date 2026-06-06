
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import {
    sequelize,
    Comic,
    Chapter,
    Page,
    ReadingProgress,
    ReadingEvent,
    Category,
    Menu,
    Setting,
    FolderMetadata,
    initDB
} from './db.js';
import { scanMangaLibrary } from './mangaScanner.js';
import { pathsOverlap, replacePathPrefix } from './pathIndexSync.js';
import { readArchiveEntryBuffer } from './archiveReader.js';
import { sortRankedComics } from './ranking.js';
import { logError, logInfo, requestLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Base image directory
const IMAGE_DIR = 'E:\\pagefile';

await initDB();

const parseSettingValue = (value) => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
};

const getSettingValue = async (key, fallback) => {
    const setting = await Setting.findByPk(key);
    return setting ? parseSettingValue(setting.value) : fallback;
};

const setSettingValue = async (key, value) => {
    const stringified = typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value);
    const [setting, created] = await Setting.findOrCreate({
        where: { key },
        defaults: { value: stringified }
    });
    if (!created) {
        setting.value = stringified;
        await setting.save();
    }
};

const getLibraryPath = async () => {
    return process.env.MANGA_LIBRARY_PATH || await getSettingValue('libraryPath', IMAGE_DIR);
};

const isInsideBase = (targetPath, basePath) => {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(basePath);
    if (process.platform === 'win32') {
        return resolvedTarget.toLowerCase() === resolvedBase.toLowerCase()
            || resolvedTarget.toLowerCase().startsWith(resolvedBase.toLowerCase() + path.sep);
    }
    return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);
};

const normalizeRelativePath = (value = '') => {
    return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);

const compareByName = (left, right) => {
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
};

const isImageFileName = (fileName) => {
    return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
};

const resolveManualCoverImage = (coverImage, libraryPath) => {
    if (!coverImage) return null;
    if (coverImage.includes('#')) return coverImage;

    const normalizedCover = normalizeRelativePath(coverImage);
    const fullCoverPath = path.resolve(libraryPath, normalizedCover);
    if (!isInsideBase(fullCoverPath, libraryPath)) return null;
    if (!fs.existsSync(fullCoverPath)) return null;

    const stat = fs.statSync(fullCoverPath);
    return stat.isFile() && isImageFileName(fullCoverPath) ? normalizedCover : null;
};

const findFirstImageInFolder = (folderPath, libraryPath, cache = new Map()) => {
    const cacheKey = path.resolve(folderPath);
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    let items = [];
    try {
        items = fs.readdirSync(folderPath, { withFileTypes: true }).sort(compareByName);
    } catch {
        cache.set(cacheKey, null);
        return null;
    }

    const directImage = items.find((item) => item.isFile() && isImageFileName(item.name));
    if (directImage) {
        const imagePath = path.join(folderPath, directImage.name);
        const relativeImagePath = path.relative(libraryPath, imagePath).replace(/\\/g, '/');
        cache.set(cacheKey, relativeImagePath);
        return relativeImagePath;
    }

    for (const item of items) {
        if (!item.isDirectory()) continue;
        const nestedImage = findFirstImageInFolder(path.join(folderPath, item.name), libraryPath, cache);
        if (nestedImage) {
            cache.set(cacheKey, nestedImage);
            return nestedImage;
        }
    }

    cache.set(cacheKey, null);
    return null;
};

const resolveFolderCoverImage = (relativePath, fullPath, libraryPath, metadataMap = {}, cache = new Map()) => {
    return resolveManualCoverImage(metadataMap[relativePath], libraryPath)
        || findFirstImageInFolder(fullPath, libraryPath, cache);
};

const resolveLibraryRelativePath = async (relativePath = '') => {
    const libraryPath = path.resolve(await getLibraryPath());
    const normalizedRelativePath = normalizeRelativePath(relativePath);
    const fullPath = path.resolve(libraryPath, normalizedRelativePath);
    if (!isInsideBase(fullPath, libraryPath)) {
        const error = new Error('Path is outside manga library');
        error.status = 403;
        throw error;
    }
    return { libraryPath, relativePath: normalizedRelativePath, fullPath };
};

const sendAdminError = (res, error, fallback = 'Operation failed') => {
    const status = error?.status || 500;
    if (status >= 500) logError(fallback, error);
    res.status(status).json({ error: error?.message || fallback });
};

const sendLibraryImage = async (relativePath, res) => {
    const libraryPath = await getLibraryPath();
    if (relativePath.includes('#')) {
        const [archiveRelativePath, entryName] = relativePath.split('#');
        const archiveFullPath = path.resolve(libraryPath, archiveRelativePath);
        if (!isInsideBase(archiveFullPath, libraryPath)) return res.status(403).send('Forbidden');
        if (!fs.existsSync(archiveFullPath)) return res.status(404).send('File not found');
        const buffer = await readArchiveEntryBuffer(archiveFullPath, entryName);
        res.setHeader('Content-Type', getContentType(entryName));
        return res.send(buffer);
    }

    const fullPath = path.resolve(libraryPath, relativePath);

    if (!isInsideBase(fullPath, libraryPath)) return res.status(403).send('Forbidden');
    if (!fs.existsSync(fullPath)) return res.status(404).send('File not found');

    res.sendFile(fullPath);
};

const getContentType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.gif': return 'image/gif';
        case '.webp': return 'image/webp';
        case '.bmp': return 'image/bmp';
        default: return 'application/octet-stream';
    }
};

const serializeComic = (comic) => {
    const plain = comic.toJSON ? comic.toJSON() : comic;
    return {
        ...plain,
        progress: plain.progress || null,
        chapterCount: plain.chapters?.length ?? plain.chapterCount ?? 0
    };
};

const rebuildMangaIndex = async (libraryPath, options = {}) => {
    const result = await scanMangaLibrary(libraryPath, options);
    const existingComics = await Comic.findAll({
        include: [{ model: Category, as: 'categories', required: false }]
    });
    const metadataBySourcePath = new Map(existingComics.map((comic) => [
        comic.sourcePath,
        {
            favorite: comic.favorite,
            readCount: comic.readCount || 0,
            lastReadAt: comic.lastReadAt,
            categoryNames: (comic.categories || []).map((category) => category.name)
        }
    ]));

    await sequelize.transaction(async (transaction) => {
        await ReadingProgress.destroy({ where: {}, transaction });
        await sequelize.models.ComicCategory.destroy({ where: {}, transaction });
        await Page.destroy({ where: {}, transaction });
        await Chapter.destroy({ where: {}, transaction });
        await Comic.destroy({ where: {}, transaction });

        for (const comicData of result.comics) {
            const comic = await Comic.create({
                title: comicData.title,
                coverPath: comicData.coverPath,
                sourcePath: comicData.sourcePath,
                sortOrder: comicData.sortOrder,
                favorite: metadataBySourcePath.get(comicData.sourcePath)?.favorite || false,
                readCount: metadataBySourcePath.get(comicData.sourcePath)?.readCount || 0,
                lastReadAt: metadataBySourcePath.get(comicData.sourcePath)?.lastReadAt || null
            }, { transaction });

            const categoryNames = metadataBySourcePath.get(comicData.sourcePath)?.categoryNames || [];
            for (const categoryName of categoryNames) {
                const [category] = await Category.findOrCreate({
                    where: { name: categoryName },
                    defaults: { sortOrder: 0 },
                    transaction
                });
                await comic.addCategory(category, { transaction });
            }

            for (const chapterData of comicData.chapters) {
                const chapter = await Chapter.create({
                    comicId: comic.id,
                    title: chapterData.title,
                    number: chapterData.number,
                    path: chapterData.path,
                    type: chapterData.type,
                    pageCount: chapterData.pageCount,
                    sortOrder: chapterData.sortOrder
                }, { transaction });

                const pages = chapterData.pages.map((page) => ({
                    chapterId: chapter.id,
                    pageIndex: page.pageIndex,
                    name: page.name,
                    filePath: page.filePath,
                    width: page.width,
                    height: page.height,
                    fileSize: page.fileSize
                }));
                if (pages.length) await Page.bulkCreate(pages, { transaction });
            }
        }
    });

    return result;
};

const syncMovedFolderIndex = async (oldPath, newPath) => {
    const normalizedOldPath = normalizeRelativePath(oldPath);
    const normalizedNewPath = normalizeRelativePath(newPath);
    if (!normalizedOldPath || !normalizedNewPath) return { comics: 0, chapters: 0, pages: 0, folderMetadata: 0 };

    const Op = sequelize.Sequelize.Op;
    const pathPrefixFilter = (field) => ({
        [Op.or]: [
            { [field]: normalizedOldPath },
            { [field]: { [Op.like]: `${normalizedOldPath}/%` } }
        ]
    });

    const counts = { comics: 0, chapters: 0, pages: 0, folderMetadata: 0 };

    await sequelize.transaction(async (transaction) => {
        const comics = await Comic.findAll({
            where: {
                [Op.or]: [
                    pathPrefixFilter('sourcePath'),
                    pathPrefixFilter('coverPath')
                ]
            },
            transaction
        });
        for (const comic of comics) {
            const nextSourcePath = replacePathPrefix(comic.sourcePath, normalizedOldPath, normalizedNewPath);
            const nextCoverPath = comic.coverPath ? replacePathPrefix(comic.coverPath, normalizedOldPath, normalizedNewPath) : comic.coverPath;
            if (nextSourcePath !== comic.sourcePath || nextCoverPath !== comic.coverPath) {
                comic.sourcePath = nextSourcePath;
                comic.coverPath = nextCoverPath;
                await comic.save({ transaction });
                counts.comics += 1;
            }
        }

        const chapters = await Chapter.findAll({ where: pathPrefixFilter('path'), transaction });
        for (const chapter of chapters) {
            const nextPath = replacePathPrefix(chapter.path, normalizedOldPath, normalizedNewPath);
            if (nextPath !== chapter.path) {
                chapter.path = nextPath;
                await chapter.save({ transaction });
                counts.chapters += 1;
            }
        }

        const pages = await Page.findAll({ where: pathPrefixFilter('filePath'), transaction });
        for (const page of pages) {
            const nextFilePath = replacePathPrefix(page.filePath, normalizedOldPath, normalizedNewPath);
            if (nextFilePath !== page.filePath) {
                page.filePath = nextFilePath;
                await page.save({ transaction });
                counts.pages += 1;
            }
        }

        const folderMetadataRows = await FolderMetadata.findAll({
            where: {
                [Op.or]: [
                    pathPrefixFilter('path'),
                    pathPrefixFilter('coverImage')
                ]
            },
            transaction
        });
        for (const metadata of folderMetadataRows) {
            const nextPath = replacePathPrefix(metadata.path, normalizedOldPath, normalizedNewPath);
            const nextCoverImage = metadata.coverImage
                ? replacePathPrefix(metadata.coverImage, normalizedOldPath, normalizedNewPath)
                : metadata.coverImage;
            if (nextPath !== metadata.path || nextCoverImage !== metadata.coverImage) {
                const values = {
                    coverImage: nextCoverImage,
                    note: metadata.note,
                    marked: !!metadata.marked
                };
                if (nextPath !== metadata.path) {
                    await FolderMetadata.destroy({ where: { path: metadata.path }, transaction });
                    await FolderMetadata.upsert({ path: nextPath, ...values }, { transaction });
                } else {
                    metadata.coverImage = nextCoverImage;
                    await metadata.save({ transaction });
                }
                counts.folderMetadata += 1;
            }
        }
    });

    return counts;
};

let folderIndexSyncJobId = 0;
let folderIndexSyncQueue = Promise.resolve();
const folderIndexSyncLocks = new Map();

const getFolderIndexSyncConflict = (oldPath, newPath) => {
    const paths = [normalizeRelativePath(oldPath), normalizeRelativePath(newPath)].filter(Boolean);
    return [...folderIndexSyncLocks.values()].find((job) => {
        return paths.some((targetPath) => (
            pathsOverlap(targetPath, job.oldPath) || pathsOverlap(targetPath, job.newPath)
        ));
    });
};

const acquireFolderIndexSyncLock = (oldPath, newPath) => {
    const normalizedOldPath = normalizeRelativePath(oldPath);
    const normalizedNewPath = normalizeRelativePath(newPath);
    const conflict = getFolderIndexSyncConflict(normalizedOldPath, normalizedNewPath);
    if (conflict) {
        const error = new Error('目录索引正在同步，请稍后再试');
        error.status = 409;
        error.syncJobId = conflict.id;
        throw error;
    }

    const job = {
        id: `folder-index-sync-${++folderIndexSyncJobId}`,
        oldPath: normalizedOldPath,
        newPath: normalizedNewPath,
        status: 'queued',
        createdAt: new Date().toISOString()
    };
    folderIndexSyncLocks.set(job.id, job);
    return job;
};

const releaseFolderIndexSyncLock = (job) => {
    folderIndexSyncLocks.delete(job.id);
};

const enqueueMovedFolderIndexSync = (job) => {
    const runJob = async () => {
        job.status = 'running';
        logInfo('admin folder index sync started', { jobId: job.id, from: job.oldPath, to: job.newPath });
        try {
            const counts = await syncMovedFolderIndex(job.oldPath, job.newPath);
            job.status = 'completed';
            logInfo('admin folder index sync completed', { jobId: job.id, from: job.oldPath, to: job.newPath, counts });
        } catch (error) {
            job.status = 'failed';
            logError('admin folder index sync failed', error, { jobId: job.id, from: job.oldPath, to: job.newPath });
        } finally {
            releaseFolderIndexSyncLock(job);
        }
    };

    folderIndexSyncQueue = folderIndexSyncQueue.then(runJob, runJob);
    return { id: job.id, status: job.status };
};

const syncMovedFileIndex = async (oldPath, newPath) => {
    const normalizedOldPath = normalizeRelativePath(oldPath);
    const normalizedNewPath = normalizeRelativePath(newPath);
    if (!normalizedOldPath || !normalizedNewPath) return { comics: 0, chapters: 0, pages: 0, folderMetadata: 0 };

    const Op = sequelize.Sequelize.Op;
    const fileReferenceFilter = (field) => ({
        [Op.or]: [
            { [field]: normalizedOldPath },
            { [field]: { [Op.like]: `${normalizedOldPath}#%` } }
        ]
    });
    const counts = { comics: 0, chapters: 0, pages: 0, folderMetadata: 0 };

    await sequelize.transaction(async (transaction) => {
        const comics = await Comic.findAll({
            where: {
                [Op.or]: [
                    { sourcePath: normalizedOldPath },
                    fileReferenceFilter('coverPath')
                ]
            },
            transaction
        });
        for (const comic of comics) {
            const nextSourcePath = replacePathPrefix(comic.sourcePath, normalizedOldPath, normalizedNewPath);
            const nextCoverPath = comic.coverPath
                ? replacePathPrefix(comic.coverPath, normalizedOldPath, normalizedNewPath)
                : comic.coverPath;
            if (nextSourcePath !== comic.sourcePath || nextCoverPath !== comic.coverPath) {
                comic.sourcePath = nextSourcePath;
                comic.coverPath = nextCoverPath;
                await comic.save({ transaction });
                counts.comics += 1;
            }
        }

        const chapters = await Chapter.findAll({ where: { path: normalizedOldPath }, transaction });
        for (const chapter of chapters) {
            chapter.path = normalizedNewPath;
            await chapter.save({ transaction });
            counts.chapters += 1;
        }

        const pages = await Page.findAll({ where: fileReferenceFilter('filePath'), transaction });
        for (const page of pages) {
            page.filePath = replacePathPrefix(page.filePath, normalizedOldPath, normalizedNewPath);
            await page.save({ transaction });
            counts.pages += 1;
        }

        const folderMetadataRows = await FolderMetadata.findAll({ where: fileReferenceFilter('coverImage'), transaction });
        for (const metadata of folderMetadataRows) {
            metadata.coverImage = replacePathPrefix(metadata.coverImage, normalizedOldPath, normalizedNewPath);
            await metadata.save({ transaction });
            counts.folderMetadata += 1;
        }
    });

    return counts;
};

const moveAdminPath = async (sourcePath, targetParentPath, options = {}) => {
    const source = await resolveLibraryRelativePath(sourcePath || '');
    const targetParent = await resolveLibraryRelativePath(targetParentPath || '');
    if (!source.relativePath) {
        const error = new Error('Cannot move manga library root');
        error.status = 403;
        throw error;
    }
    if (!fs.existsSync(source.fullPath)) {
        const error = new Error('Source path not found');
        error.status = 404;
        throw error;
    }
    if (!fs.existsSync(targetParent.fullPath)) {
        const error = new Error('Target folder not found');
        error.status = 404;
        throw error;
    }
    if (!fs.statSync(targetParent.fullPath).isDirectory()) {
        const error = new Error('Target path is not a folder');
        error.status = 400;
        throw error;
    }

    const sourceStat = fs.statSync(source.fullPath);
    if (options.expectedType === 'folder' && !sourceStat.isDirectory()) {
        const error = new Error('Source path is not a folder');
        error.status = 400;
        throw error;
    }
    if (options.expectedType === 'file' && !sourceStat.isFile()) {
        const error = new Error('Source path is not a file');
        error.status = 400;
        throw error;
    }
    if (sourceStat.isDirectory()
        && (targetParent.fullPath === source.fullPath || isInsideBase(targetParent.fullPath, source.fullPath))) {
        const error = new Error('Cannot move a folder into itself');
        error.status = 400;
        throw error;
    }

    const targetPath = path.resolve(targetParent.fullPath, path.basename(source.fullPath));
    if (!isInsideBase(targetPath, source.libraryPath)) {
        const error = new Error('Target path is outside manga library');
        error.status = 403;
        throw error;
    }
    if (targetPath === source.fullPath) {
        const error = new Error('Source and target are the same path');
        error.status = 400;
        throw error;
    }
    if (fs.existsSync(targetPath)) {
        const error = new Error('Target name already exists');
        error.status = 400;
        throw error;
    }

    const newPath = path.relative(source.libraryPath, targetPath).replace(/\\/g, '/');
    if (sourceStat.isDirectory()) {
        const syncJob = acquireFolderIndexSyncLock(source.relativePath, newPath);
        try {
            fs.renameSync(source.fullPath, targetPath);
        } catch (error) {
            releaseFolderIndexSyncLock(syncJob);
            throw error;
        }
        const indexSync = enqueueMovedFolderIndexSync(syncJob);
        return {
            path: newPath,
            type: 'folder',
            requiresScan: false,
            requiresIndexRefresh: true,
            indexSync
        };
    }

    fs.renameSync(source.fullPath, targetPath);
    const indexSync = await syncMovedFileIndex(source.relativePath, newPath);
    return {
        path: newPath,
        type: 'file',
        requiresScan: false,
        requiresIndexRefresh: false,
        indexSync
    };
};

// Helper: Convert flat list to tree
const buildMenuTree = (menus, parentId = null) => {
    return menus
        .filter(menu => menu.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map(menu => ({
            id: menu.id,
            name: menu.name,
            path: menu.path,
            children: buildMenuTree(menus, menu.id)
        }));
};

// --- API: Manga Library ---

app.get('/api/library/comics', async (req, res) => {
    try {
        const comics = await Comic.findAll({
            include: [
                { model: Chapter, as: 'chapters', attributes: ['id', 'title', 'sortOrder'], required: false },
                { model: ReadingProgress, as: 'progress', required: false },
                { model: Category, as: 'categories', required: false }
            ],
            order: [['sortOrder', 'ASC'], ['title', 'ASC']]
        });
        res.json(comics.map(serializeComic));
    } catch (error) {
        console.error('Error fetching comics:', error);
        res.status(500).json({ error: 'Failed to fetch comics' });
    }
});

app.get('/api/library/comics/:id', async (req, res) => {
    try {
        const comic = await Comic.findByPk(req.params.id, {
            include: [
                { model: Chapter, as: 'chapters', order: [['sortOrder', 'ASC']], required: false },
                { model: ReadingProgress, as: 'progress', required: false },
                { model: Category, as: 'categories', required: false }
            ]
        });
        if (!comic) return res.status(404).json({ error: 'Comic not found' });

        const plain = serializeComic(comic);
        plain.chapters = (plain.chapters || []).sort((a, b) => a.sortOrder - b.sortOrder);
        res.json(plain);
    } catch (error) {
        console.error('Error fetching comic:', error);
        res.status(500).json({ error: 'Failed to fetch comic' });
    }
});

app.get('/api/library/comics/:id/chapters', async (req, res) => {
    try {
        const chapters = await Chapter.findAll({
            where: { comicId: req.params.id },
            order: [['sortOrder', 'ASC']]
        });
        res.json(chapters);
    } catch (error) {
        console.error('Error fetching chapters:', error);
        res.status(500).json({ error: 'Failed to fetch chapters' });
    }
});

app.post('/api/library/scan', async (req, res) => {
    try {
        const libraryPath = req.body?.libraryPath || await getLibraryPath();
        if (!fs.existsSync(libraryPath)) {
            return res.status(404).json({ error: 'Manga library not found', libraryPath });
        }

        await setSettingValue('libraryPath', libraryPath);
        const rootMode = req.body?.rootMode || 'grouped';
        const startedAt = Date.now();
        logInfo('library scan started', { libraryPath, rootMode });
        const result = await rebuildMangaIndex(libraryPath, { rootMode });
        const comicCount = result.comics.length;
        const chapterCount = result.comics.reduce((sum, comic) => sum + comic.chapters.length, 0);
        const pageCount = result.comics.reduce((sum, comic) => {
            return sum + comic.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.pages.length, 0);
        }, 0);
        logInfo('library scan completed', {
            libraryPath,
            rootMode,
            comicCount,
            chapterCount,
            pageCount,
            durationMs: Date.now() - startedAt
        });
        res.json({
            success: true,
            libraryPath,
            rootMode,
            comicCount,
            chapterCount,
            pageCount
        });
    } catch (error) {
        logError('Error scanning manga library:', error);
        res.status(500).json({ error: 'Failed to scan manga library', detail: error?.message || String(error) });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.findAll({ order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
        res.json(categories);
    } catch (error) {
        logError('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Category name is required' });
        const existing = await Category.findOne({
            where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), name.toLowerCase())
        });
        if (existing) return res.status(409).json({ error: 'Category already exists' });
        const count = await Category.count();
        const sortOrder = req.body?.sortOrder === undefined
            ? count
            : Number(req.body.sortOrder);
        const category = await Category.create({
            name,
            sortOrder: Number.isFinite(sortOrder) ? sortOrder : count
        });
        logInfo('category created', { id: category.id, name: category.name });
        res.json(category);
    } catch (error) {
        logError('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

app.put('/api/categories/:id', async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        if (req.body.name !== undefined) category.name = String(req.body.name).trim();
        if (req.body.sortOrder !== undefined) category.sortOrder = Number(req.body.sortOrder) || 0;
        await category.save();
        logInfo('category updated', { id: category.id, name: category.name, sortOrder: category.sortOrder });
        res.json(category);
    } catch (error) {
        logError('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    try {
        const category = await Category.findByPk(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        const categoryInfo = { id: category.id, name: category.name };
        await category.destroy();
        logInfo('category deleted', categoryInfo);
        res.json({ success: true });
    } catch (error) {
        logError('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

app.put('/api/comics/:id/favorite', async (req, res) => {
    try {
        const comic = await Comic.findByPk(req.params.id);
        if (!comic) return res.status(404).json({ error: 'Comic not found' });
        comic.favorite = !!req.body.favorite;
        await comic.save();
        logInfo('comic favorite updated', { id: comic.id, title: comic.title, favorite: comic.favorite });
        res.json(comic);
    } catch (error) {
        logError('Error updating favorite:', error);
        res.status(500).json({ error: 'Failed to update favorite' });
    }
});

app.put('/api/comics/:id/categories', async (req, res) => {
    try {
        const comic = await Comic.findByPk(req.params.id);
        if (!comic) return res.status(404).json({ error: 'Comic not found' });
        const categoryIds = Array.isArray(req.body.categoryIds) ? req.body.categoryIds : [];
        const categories = await Category.findAll({ where: { id: categoryIds } });
        await comic.setCategories(categories);
        const updated = await Comic.findByPk(req.params.id, {
            include: [{ model: Category, as: 'categories', required: false }]
        });
        logInfo('comic categories updated', { id: comic.id, title: comic.title, categoryCount: categories.length });
        res.json(updated);
    } catch (error) {
        logError('Error updating comic categories:', error);
        res.status(500).json({ error: 'Failed to update comic categories' });
    }
});

app.put('/api/comics/:id/cover', async (req, res) => {
    try {
        const comic = await Comic.findByPk(req.params.id);
        if (!comic) return res.status(404).json({ error: 'Comic not found' });
        const coverPath = String(req.body.coverPath || '').trim();
        if (!coverPath) return res.status(400).json({ error: 'coverPath is required' });
        comic.coverPath = coverPath;
        await comic.save();
        logInfo('comic cover updated', { id: comic.id, title: comic.title, coverPath });
        res.json(comic);
    } catch (error) {
        logError('Error updating comic cover:', error);
        res.status(500).json({ error: 'Failed to update comic cover' });
    }
});

app.delete('/api/comics/:id', async (req, res) => {
    try {
        const comic = await Comic.findByPk(req.params.id);
        if (!comic) return res.status(404).json({ error: 'Comic not found' });
        const comicInfo = { id: comic.id, title: comic.title, sourcePath: comic.sourcePath };
        await ReadingProgress.destroy({ where: { comicId: comic.id } });
        await ReadingEvent.destroy({ where: { comicId: comic.id } });
        await sequelize.models.ComicCategory.destroy({ where: { comicId: comic.id } });
        const chapters = await Chapter.findAll({ where: { comicId: comic.id }, attributes: ['id'] });
        const chapterIds = chapters.map((chapter) => chapter.id);
        if (chapterIds.length) await Page.destroy({ where: { chapterId: chapterIds } });
        await Chapter.destroy({ where: { comicId: comic.id } });
        await comic.destroy();
        logInfo('comic index deleted', comicInfo);
        res.json({ success: true });
    } catch (error) {
        logError('Error deleting comic index:', error);
        res.status(500).json({ error: 'Failed to delete comic index' });
    }
});

// --- API: Admin File Management ---

app.get('/api/admin/folders', async (req, res) => {
    try {
        const { libraryPath, relativePath, fullPath } = await resolveLibraryRelativePath(req.query.dir || '');
        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Folder not found' });
        const stat = fs.statSync(fullPath);
        if (!stat.isDirectory()) return res.status(400).json({ error: 'Path is not a folder' });

        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        const folders = [];
        const images = [];

        const folderPaths = items
            .filter((item) => item.isDirectory())
            .map((item) => path.relative(libraryPath, path.join(fullPath, item.name)).replace(/\\/g, '/'));
        const metadataList = folderPaths.length
            ? await FolderMetadata.findAll({ where: { path: folderPaths } })
            : [];
        const metadataMap = Object.fromEntries(metadataList.map((item) => [item.path, {
            coverImage: item.coverImage,
            marked: !!item.marked
        }]));
        const coverMetadataMap = Object.fromEntries(metadataList.map((item) => [item.path, item.coverImage]));
        const hideMarked = req.query.hideMarked === 'true';
        const coverCache = new Map();

        for (const item of items) {
            const itemPath = path.join(fullPath, item.name);
            const itemRelativePath = path.relative(libraryPath, itemPath).replace(/\\/g, '/');
            if (item.isDirectory()) {
                const metadata = metadataMap[itemRelativePath] || {};
                if (hideMarked && metadata.marked) continue;
                folders.push({
                    name: item.name,
                    path: itemRelativePath,
                    coverImage: resolveFolderCoverImage(itemRelativePath, itemPath, libraryPath, coverMetadataMap, coverCache),
                    marked: !!metadata.marked
                });
            } else if (item.isFile()) {
                if (isImageFileName(item.name)) {
                    images.push({
                        name: item.name,
                        path: itemRelativePath,
                        relativePath: itemRelativePath,
                        size: fs.statSync(itemPath).size
                    });
                }
            }
        }

        folders.sort(compareByName);
        images.sort(compareByName);

        res.json({ libraryPath, currentPath: relativePath, folders, images });
    } catch (error) {
        sendAdminError(res, error, 'Failed to list admin folder');
    }
});

app.post('/api/admin/folders', async (req, res) => {
    try {
        const parent = await resolveLibraryRelativePath(req.body?.parentPath || '');
        const name = String(req.body?.name || '').trim();
        if (!name) return res.status(400).json({ error: 'Folder name is required' });
        if (name.includes('/') || name.includes('\\')) {
            return res.status(400).json({ error: 'Folder name cannot contain path separators' });
        }
        if (!fs.existsSync(parent.fullPath)) return res.status(404).json({ error: 'Parent folder not found' });
        if (!fs.statSync(parent.fullPath).isDirectory()) return res.status(400).json({ error: 'Parent path is not a folder' });

        const targetPath = path.resolve(parent.fullPath, name);
        if (!isInsideBase(targetPath, parent.libraryPath)) return res.status(403).json({ error: 'Target path is outside manga library' });
        if (fs.existsSync(targetPath)) return res.status(400).json({ error: 'Folder already exists' });

        fs.mkdirSync(targetPath);
        const newPath = path.relative(parent.libraryPath, targetPath).replace(/\\/g, '/');
        logInfo('admin folder created', { path: newPath });
        res.json({ success: true, path: newPath });
    } catch (error) {
        sendAdminError(res, error, 'Failed to create admin folder');
    }
});

app.post('/api/admin/files/rename', async (req, res) => {
    try {
        const { libraryPath, relativePath, fullPath } = await resolveLibraryRelativePath(req.body?.path || '');
        const newName = String(req.body?.newName || '').trim();
        if (!newName) return res.status(400).json({ error: 'New name is required' });
        if (newName.includes('/') || newName.includes('\\')) {
            return res.status(400).json({ error: 'New name cannot contain path separators' });
        }
        if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Source path not found' });
        if (relativePath === '') return res.status(403).json({ error: 'Cannot rename manga library root' });

        const targetPath = path.resolve(path.dirname(fullPath), newName);
        if (!isInsideBase(targetPath, libraryPath)) return res.status(403).json({ error: 'Target path is outside manga library' });
        if (fs.existsSync(targetPath)) return res.status(400).json({ error: 'Target name already exists' });

        fs.renameSync(fullPath, targetPath);
        const newPath = path.relative(libraryPath, targetPath).replace(/\\/g, '/');
        logInfo('admin file renamed', { from: relativePath, to: newPath });
        res.json({ success: true, path: newPath, requiresScan: true });
    } catch (error) {
        sendAdminError(res, error, 'Failed to rename admin file');
    }
});

app.post('/api/admin/folders/move', async (req, res) => {
    try {
        const result = await moveAdminPath(req.body?.path || '', req.body?.targetParentPath || '', { expectedType: 'folder' });
        logInfo('admin folder moved', { from: req.body?.path || '', to: result.path, indexSync: result.indexSync });
        res.json({ success: true, ...result });
    } catch (error) {
        sendAdminError(res, error, 'Failed to move admin folder');
    }
});

app.post('/api/admin/files/move', async (req, res) => {
    try {
        const result = await moveAdminPath(req.body?.path || '', req.body?.targetParentPath || '');
        logInfo('admin path moved', { from: req.body?.path || '', to: result.path, type: result.type, indexSync: result.indexSync });
        res.json({ success: true, ...result });
    } catch (error) {
        sendAdminError(res, error, 'Failed to move admin path');
    }
});

app.post('/api/admin/folders/mark', async (req, res) => {
    try {
        const folder = await resolveLibraryRelativePath(req.body?.folderPath || '');
        if (!folder.relativePath) return res.status(403).json({ error: 'Cannot mark manga library root' });
        if (!fs.existsSync(folder.fullPath) || !fs.statSync(folder.fullPath).isDirectory()) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const marked = !!req.body?.marked;
        const [metadata] = await FolderMetadata.findOrCreate({
            where: { path: folder.relativePath },
            defaults: { coverImage: null, note: null, marked }
        });
        if (metadata.marked !== marked) {
            metadata.marked = marked;
            await metadata.save();
        }
        logInfo('admin folder marked updated', { folderPath: folder.relativePath, marked });
        res.json({ success: true, folderPath: folder.relativePath, marked });
    } catch (error) {
        sendAdminError(res, error, 'Failed to update admin folder mark');
    }
});

app.delete('/api/admin/files', async (req, res) => {
    try {
        const target = await resolveLibraryRelativePath(req.query.path || '');
        if (!target.relativePath) return res.status(403).json({ error: 'Cannot delete manga library root' });
        if (!fs.existsSync(target.fullPath)) return res.status(404).json({ error: 'Path not found' });

        const stat = fs.statSync(target.fullPath);
        if (stat.isDirectory()) {
            fs.rmSync(target.fullPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(target.fullPath);
        }
        logInfo('admin path deleted', { path: target.relativePath, type: stat.isDirectory() ? 'folder' : 'file' });
        res.json({ success: true, requiresScan: true });
    } catch (error) {
        sendAdminError(res, error, 'Failed to delete admin file');
    }
});

app.post('/api/admin/files/reveal', async (req, res) => {
    try {
        const target = await resolveLibraryRelativePath(req.body?.path || '');
        if (!fs.existsSync(target.fullPath)) return res.status(404).json({ error: 'Path not found' });

        const stat = fs.statSync(target.fullPath);
        if (process.platform === 'win32') {
            const args = stat.isDirectory()
                ? [target.fullPath]
                : [`/select,${target.fullPath}`];
            const child = spawn('explorer.exe', args, { detached: true, stdio: 'ignore' });
            child.unref();
        } else if (process.platform === 'darwin') {
            const args = stat.isDirectory()
                ? [target.fullPath]
                : ['-R', target.fullPath];
            const child = spawn('open', args, { detached: true, stdio: 'ignore' });
            child.unref();
        } else {
            const directoryPath = stat.isDirectory() ? target.fullPath : path.dirname(target.fullPath);
            const child = spawn('xdg-open', [directoryPath], { detached: true, stdio: 'ignore' });
            child.unref();
        }

        res.json({ success: true });
    } catch (error) {
        sendAdminError(res, error, 'Failed to reveal admin file');
    }
});

app.post('/api/admin/folders/cover', async (req, res) => {
    try {
        const folder = await resolveLibraryRelativePath(req.body?.folderPath || '');
        const image = await resolveLibraryRelativePath(req.body?.imagePath || '');
        if (!fs.existsSync(folder.fullPath) || !fs.statSync(folder.fullPath).isDirectory()) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        if (!fs.existsSync(image.fullPath) || !fs.statSync(image.fullPath).isFile()) {
            return res.status(404).json({ error: 'Image not found' });
        }
        await FolderMetadata.upsert({
            path: folder.relativePath,
            coverImage: image.relativePath
        });
        logInfo('admin folder cover set', { folderPath: folder.relativePath, coverImage: image.relativePath });
        res.json({ success: true, folderPath: folder.relativePath, coverImage: image.relativePath });
    } catch (error) {
        sendAdminError(res, error, 'Failed to set admin folder cover');
    }
});

app.get('/api/chapters/:id', async (req, res) => {
    try {
        const chapter = await Chapter.findByPk(req.params.id, {
            include: [{
                model: Comic,
                as: 'comic',
                include: [{ model: ReadingProgress, as: 'progress', required: false }]
            }]
        });
        if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
        const siblings = await Chapter.findAll({
            where: { comicId: chapter.comicId },
            order: [['sortOrder', 'ASC']],
            attributes: ['id', 'title', 'sortOrder']
        });
        const index = siblings.findIndex((item) => item.id === chapter.id);
        const plain = chapter.toJSON();
        plain.previousChapter = index > 0 ? siblings[index - 1] : null;
        plain.nextChapter = index > -1 && index < siblings.length - 1 ? siblings[index + 1] : null;
        res.json(plain);
    } catch (error) {
        console.error('Error fetching chapter:', error);
        res.status(500).json({ error: 'Failed to fetch chapter' });
    }
});

app.get('/api/chapters/:id/pages', async (req, res) => {
    try {
        const pages = await Page.findAll({
            where: { chapterId: req.params.id },
            order: [['pageIndex', 'ASC']]
        });
        res.json(pages);
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ error: 'Failed to fetch pages' });
    }
});

app.get('/api/pages/:id/image', async (req, res) => {
    try {
        const page = await Page.findByPk(req.params.id);
        if (!page) return res.status(404).send('Page not found');
        await sendLibraryImage(page.filePath, res);
    } catch (error) {
        console.error('Error serving page image:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/pages/:id/thumb', async (req, res) => {
    try {
        const page = await Page.findByPk(req.params.id);
        if (!page) return res.status(404).send('Page not found');
        await sendLibraryImage(page.thumbPath || page.filePath, res);
    } catch (error) {
        console.error('Error serving thumbnail:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/library/image/:imagePath(*)', async (req, res) => {
    try {
        await sendLibraryImage(req.params.imagePath, res);
    } catch (error) {
        console.error('Error serving library image:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/progress', async (req, res) => {
    try {
        const where = req.query.comicId ? { comicId: req.query.comicId } : {};
        const progress = await ReadingProgress.findAll({ where });
        res.json(progress);
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});

app.put('/api/progress', async (req, res) => {
    try {
        const { comicId, chapterId, pageIndex = 0, scrollOffset = 0 } = req.body;
        if (!comicId || !chapterId) return res.status(400).json({ error: 'comicId and chapterId are required' });

        const [progress, created] = await ReadingProgress.findOrCreate({
            where: { comicId },
            defaults: { comicId, chapterId, pageIndex, scrollOffset }
        });
        if (!created) {
            progress.chapterId = chapterId;
            progress.pageIndex = pageIndex;
            progress.scrollOffset = scrollOffset;
            await progress.save();
        }

        res.json(progress);
    } catch (error) {
        console.error('Error saving progress:', error);
        res.status(500).json({ error: 'Failed to save progress' });
    }
});

app.get('/api/recent', async (req, res) => {
    try {
        const progress = await ReadingProgress.findAll({
            include: [
                { model: Comic, as: 'comic' },
                { model: Chapter, as: 'chapter' }
            ],
            order: [['updatedAt', 'DESC']],
            limit: 20
        });
        res.json(progress);
    } catch (error) {
        console.error('Error fetching recent:', error);
        res.status(500).json({ error: 'Failed to fetch recent' });
    }
});

app.post('/api/reading-events', async (req, res) => {
    try {
        const { comicId, chapterId, pageIndex = 0 } = req.body;
        if (!comicId || !chapterId) return res.status(400).json({ error: 'comicId and chapterId are required' });

        const comic = await Comic.findByPk(comicId);
        const chapter = await Chapter.findByPk(chapterId);
        if (!comic || !chapter || chapter.comicId !== Number(comicId)) {
            return res.status(404).json({ error: 'Comic or chapter not found' });
        }

        const event = await ReadingEvent.create({
            comicId,
            chapterId,
            pageIndex
        });

        comic.readCount = (comic.readCount || 0) + 1;
        comic.lastReadAt = event.createdAt;
        await comic.save();

        res.json({
            success: true,
            readCount: comic.readCount,
            lastReadAt: comic.lastReadAt
        });
    } catch (error) {
        console.error('Error recording reading event:', error);
        res.status(500).json({ error: 'Failed to record reading event' });
    }
});

app.get('/api/ranking', async (req, res) => {
    try {
        const comics = await Comic.findAll({
            include: [
                { model: Chapter, as: 'chapters', attributes: ['id', 'title', 'sortOrder'], required: false },
                { model: ReadingProgress, as: 'progress', required: false },
                { model: Category, as: 'categories', required: false }
            ]
        });
        const ranked = sortRankedComics(comics.map(serializeComic));
        res.json(ranked);
    } catch (error) {
        console.error('Error fetching ranking:', error);
        res.status(500).json({ error: 'Failed to fetch ranking' });
    }
});

// --- API: Menus ---

// Get Menu Tree
app.get('/api/menus', async (req, res) => {
    try {
        const menus = await Menu.findAll();
        const tree = buildMenuTree(menus);
        res.json(tree);
    } catch (error) {
        console.error('Error fetching menus:', error);
        res.status(500).json({ error: 'Failed to fetch menus' });
    }
});

// Create Menu
app.post('/api/menus', async (req, res) => {
    try {
        const { name, path, parentId } = req.body;
        const count = await Menu.count({ where: { parentId: parentId || null } });
        const menu = await Menu.create({
            name,
            path,
            parentId: parentId || null,
            order: count
        });
        res.json(menu);
    } catch (error) {
        console.error('Error creating menu:', error);
        res.status(500).json({ error: 'Failed to create menu' });
    }
});

// Update Menu (Rename, Move, Reorder)
app.put('/api/menus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, path, parentId, order } = req.body;
        const menu = await Menu.findByPk(id);
        if (!menu) return res.status(404).json({ error: 'Menu not found' });

        if (name !== undefined) menu.name = name;
        if (path !== undefined) menu.path = path;
        if (parentId !== undefined) menu.parentId = parentId;
        if (order !== undefined) menu.order = order;

        await menu.save();
        res.json(menu);
    } catch (error) {
        console.error('Error updating menu:', error);
        res.status(500).json({ error: 'Failed to update menu' });
    }
});

// Delete Menu
app.delete('/api/menus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const menu = await Menu.findByPk(id);
        if (!menu) return res.status(404).json({ error: 'Menu not found' });
        
        await menu.destroy(); 
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting menu:', error);
        res.status(500).json({ error: 'Failed to delete menu' });
    }
});

// Scan directory and populate menus (Generate)
app.post('/api/menus/scan', async (req, res) => {
    try {
        if (!fs.existsSync(IMAGE_DIR)) {
            return res.status(404).json({ error: 'Base image directory not found', base: IMAGE_DIR });
        }
        // SQLite 自引用外键可能阻止批量清空，这里临时关闭外键约束
        await sequelize.query('PRAGMA foreign_keys = OFF');
        // 重建菜单表以确保 parentId 可为空、无历史外键残留
        const qi = sequelize.getQueryInterface();
        try { await qi.dropTable('menus'); } catch (_) {}
        await Menu.sync({ force: true });
        await sequelize.query('PRAGMA foreign_keys = ON');

        const scanDir = async (currentPath, parentId = null) => {
            let items;
            try {
                items = fs.readdirSync(currentPath, { withFileTypes: true });
            } catch (e) {
                return;
            }

            const dirs = items.filter(item => item.isDirectory())
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            for (let i = 0; i < dirs.length; i++) {
                const dir = dirs[i];
                const fullPath = path.join(currentPath, dir.name);
                const relativePath = path.relative(IMAGE_DIR, fullPath).replace(/\\/g, '/');
                
                let menu;
                try {
                    menu = await Menu.create({
                        name: dir.name,
                        path: relativePath,
                        parentId: parentId,
                        order: i
                    });
                } catch (e) {
                    console.error('Menu.create failed', { name: dir.name, path: relativePath, parentId, order: i, error: e.message });
                    throw e;
                }

                await scanDir(fullPath, menu.id);
            }
        };

        await scanDir(IMAGE_DIR);
        res.json({ success: true });
    } catch (error) {
        console.error('Error scanning directories:', error);
        let extra = undefined;
        if (error && Array.isArray(error.errors)) {
            extra = error.errors.map(e => ({ message: e.message, path: e.path, value: e.value }));
        }
        res.status(500).json({ error: 'Failed to scan directories', detail: error?.message || String(error), extra });
    }
});


// --- API: Folders & Files ---

// List folder content
app.get('/api/folder-content', async (req, res) => {
    try {
        const rawParam = req.query.dir || '';
        const decodedParam = decodeURIComponent(String(rawParam).replace(/\+/g, ' '));
        const baseDir = path.resolve(IMAGE_DIR);
        const variants = [
            decodedParam,
            decodedParam.normalize('NFC'),
            decodedParam.normalize('NFD'),
            decodedParam.replace(/\u00A0/g, ' '),
            decodedParam.replace(/ /g, '\u00A0'),
            decodedParam.trim()
        ];
        let chosenParam = decodedParam;
        for (const v of variants) {
            const p = path.resolve(IMAGE_DIR, v);
            const inside = process.platform === 'win32' ? p.toLowerCase().startsWith(baseDir.toLowerCase()) : p.startsWith(baseDir);
            if (inside && fs.existsSync(p)) { chosenParam = v; break; }
        }
        const targetDir = path.resolve(IMAGE_DIR, chosenParam);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 0; // 0 means all
        
        const insideBase = process.platform === 'win32'
            ? targetDir.toLowerCase().startsWith(baseDir.toLowerCase())
            : targetDir.startsWith(baseDir);
        if (!insideBase) return res.status(403).json({ error: 'Forbidden' });
        if (!fs.existsSync(targetDir)) return res.status(404).json({ error: 'Not found' });

        // Pre-fetch folder metadata to attach covers
        const items = fs.readdirSync(targetDir, { withFileTypes: true });
        
        const folders = [];
        const images = [];

        const dirPaths = items
            .filter(item => item.isDirectory())
            .map(item => path.relative(IMAGE_DIR, path.join(targetDir, item.name)).replace(/\\/g, '/'));

        let allMetadata = [];
        if (dirPaths.length > 0) {
            allMetadata = await FolderMetadata.findAll({
                where: { path: dirPaths }
            });
        }
        const metadataMap = {};
        allMetadata.forEach(m => metadataMap[m.path] = m.coverImage);
        const coverCache = new Map();

        for (const item of items) {
            if (item.isDirectory()) {
                const relPath = path.relative(IMAGE_DIR, path.join(targetDir, item.name)).replace(/\\/g, '/');
                const itemFullPath = path.join(targetDir, item.name);
                folders.push({
                    name: item.name,
                    path: relPath,
                    coverImage: resolveFolderCoverImage(relPath, itemFullPath, IMAGE_DIR, metadataMap, coverCache)
                });
            } else if (item.isFile()) {
                if (isImageFileName(item.name)) {
                    images.push({
                        name: item.name,
                        relativePath: path.relative(IMAGE_DIR, path.join(targetDir, item.name)).replace(/\\/g, '/')
                    });
                }
            }
        }

        folders.sort(compareByName);
        images.sort(compareByName);

        const totalImages = images.length;
        let paginatedImages = images;

        if (limit > 0) {
            const start = (page - 1) * limit;
            const end = start + limit;
            paginatedImages = images.slice(start, end);
        }

        const metadataKey = chosenParam.replace(/\\/g, '/');
        const metadata = await FolderMetadata.findByPk(metadataKey) || {};

        res.json({ folders, images: paginatedImages, totalImages, metadata });
    } catch (error) {
        console.error('Error reading folder:', error);
        res.status(500).json({ error: 'Failed to read folder' });
    }
});

// Rename Folder or File
app.post('/api/file/rename', async (req, res) => {
    try {
        const { oldPath, newName } = req.body;
        const fullOldPath = path.join(IMAGE_DIR, oldPath);
        const parentDir = path.dirname(fullOldPath);
        const fullNewPath = path.join(parentDir, newName);

        if (!fullOldPath.startsWith(IMAGE_DIR)) return res.status(403).json({ error: 'Forbidden' });
        
        if (fs.existsSync(fullNewPath)) {
            return res.status(400).json({ error: 'Target name already exists' });
        }

        fs.renameSync(fullOldPath, fullNewPath);

        // If it's a directory, update menus
        if (fs.statSync(fullNewPath).isDirectory()) {
            const menus = await Menu.findAll();
            const oldPathNormalized = oldPath.replace(/\\/g, '/');
            const newPathNormalized = path.relative(IMAGE_DIR, fullNewPath).replace(/\\/g, '/');

            for (const menu of menus) {
                if (menu.path === oldPathNormalized) {
                    menu.path = newPathNormalized;
                    menu.name = newName; 
                    await menu.save();
                } else if (menu.path && menu.path.startsWith(oldPathNormalized + '/')) {
                    menu.path = menu.path.replace(oldPathNormalized + '/', newPathNormalized + '/');
                    await menu.save();
                }
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error renaming:', error);
        res.status(500).json({ error: 'Failed to rename' });
    }
});

// Batch Rename Images in Folder (Add Prefix)
app.post('/api/folder/batch-prefix', async (req, res) => {
    try {
        const { dir, prefix } = req.body;
        if (!prefix) return res.status(400).json({ error: 'Prefix required' });

        const targetDir = path.join(IMAGE_DIR, dir);
        if (!targetDir.startsWith(IMAGE_DIR)) return res.status(403).json({ error: 'Forbidden' });

        const items = fs.readdirSync(targetDir);
        let count = 0;

        for (const item of items) {
            const fullPath = path.join(targetDir, item);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) {
                    const ext = path.extname(item).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
                        const newName = prefix + item;
                        const newPath = path.join(targetDir, newName);
                        if (!fs.existsSync(newPath)) {
                            fs.renameSync(fullPath, newPath);
                            count++;
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to rename ${item}:`, e);
            }
        }

        res.json({ success: true, count });
    } catch (error) {
        console.error('Error batch renaming:', error);
        res.status(500).json({ error: 'Failed to batch rename' });
    }
});

// Move Folder
app.post('/api/folder/move', async (req, res) => {
    try {
        const { oldPath, newParentPath } = req.body;
        const fullOldPath = path.join(IMAGE_DIR, oldPath);
        const folderName = path.basename(fullOldPath);
        const fullNewParentPath = path.join(IMAGE_DIR, newParentPath || ''); // empty for root
        const fullNewPath = path.join(fullNewParentPath, folderName);

        if (!fullOldPath.startsWith(IMAGE_DIR) || !fullNewPath.startsWith(IMAGE_DIR)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        if (fs.existsSync(fullNewPath)) {
            return res.status(400).json({ error: 'Target folder already exists' });
        }

        fs.renameSync(fullOldPath, fullNewPath);

        // Update Menus
        const menus = await Menu.findAll();
        const oldPathNormalized = oldPath.replace(/\\/g, '/');
        const newPathNormalized = path.relative(IMAGE_DIR, fullNewPath).replace(/\\/g, '/');

        for (const menu of menus) {
            if (menu.path === oldPathNormalized) {
                menu.path = newPathNormalized;
                // Move menu in DB too? If menu structure mirrors folders, we might need to change parentId.
                // But user might have custom menu structure.
                // However, "drag folder to menu" implies we want to move the folder to where the menu points.
                // If the menu is just a pointer, updating path is enough.
                await menu.save();
            } else if (menu.path && menu.path.startsWith(oldPathNormalized + '/')) {
                menu.path = menu.path.replace(oldPathNormalized + '/', newPathNormalized + '/');
                await menu.save();
            }
        }

        res.json({ success: true, newPath: newPathNormalized });
    } catch (error) {
        console.error('Error moving folder:', error);
        res.status(500).json({ error: 'Failed to move folder' });
    }
});

// Delete Folder Check (Stats)
app.get('/api/folder/stats', (req, res) => {
    try {
        const dirParam = req.query.dir || '';
        const targetDir = path.join(IMAGE_DIR, dirParam);
        
        if (!targetDir.startsWith(IMAGE_DIR)) return res.status(403).json({ error: 'Forbidden' });

        const getStats = (dir) => {
            let fileCount = 0;
            const children = [];
            
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    children.push(getStats(path.join(dir, item.name)));
                } else {
                    fileCount++;
                }
            }
            
            return {
                name: path.basename(dir),
                fileCount,
                children
            };
        };

        const stats = getStats(targetDir);
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Delete Folder
app.delete('/api/folder', async (req, res) => {
    try {
        const dirParam = req.query.dir || '';
        const targetDir = path.join(IMAGE_DIR, dirParam);
        
        if (!targetDir.startsWith(IMAGE_DIR)) return res.status(403).json({ error: 'Forbidden' });
        if (targetDir === IMAGE_DIR) return res.status(403).json({ error: 'Cannot delete root' });

        fs.rmSync(targetDir, { recursive: true, force: true });
        
        const relativePath = dirParam.replace(/\\/g, '/');
        await Menu.destroy({ 
            where: { 
                path: relativePath 
            }
        });
        const Op = sequelize.Sequelize.Op;
        await Menu.destroy({
            where: {
                path: { [Op.like]: `${relativePath}/%` }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// Delete File
app.delete('/api/file', async (req, res) => {
    try {
        const filePathParam = req.query.path || '';
        const targetPath = path.join(IMAGE_DIR, filePathParam);
        
        if (!targetPath.startsWith(IMAGE_DIR)) return res.status(403).json({ error: 'Forbidden' });
        
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Set Cover Image
app.post('/api/folder/cover', async (req, res) => {
    try {
        const { dir, imagePath } = req.body;
        const relativeDir = dir.replace(/\\/g, '/');
        await FolderMetadata.upsert({
            path: relativeDir,
            coverImage: imagePath
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error setting cover:', error);
        res.status(500).json({ error: 'Failed to set cover' });
    }
});

// --- API: Settings ---

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await Setting.findAll();
        const settingsMap = {};
        settings.forEach(s => {
            let val = s.value;
            if (typeof val === 'string') {
                try { val = JSON.parse(val); } catch (_) {}
            }
            settingsMap[s.key] = val;
        });
        res.json(settingsMap);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        const stringified = typeof value === 'string' ? value : JSON.stringify(value);
        const [setting, created] = await Setting.findOrCreate({
            where: { key },
            defaults: { value: stringified }
        });
        if (!created) {
            setting.value = stringified;
            await setting.save();
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

// --- Legacy API support ---

app.get('/api/image/:imagePath(*)', (req, res) => {
    try {
        const imagePath = req.params.imagePath;
        const fullPath = path.join(IMAGE_DIR, imagePath);

        const normalizedPath = path.normalize(fullPath);
        const normalizedBase = path.normalize(IMAGE_DIR);

        if (!normalizedPath.startsWith(normalizedBase)) {
            return res.status(403).send('Forbidden');
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).send('File not found');
        }

        const ext = path.extname(fullPath).toLowerCase();
        let contentType = 'application/octet-stream';

        switch (ext) {
            case '.jpg':
            case '.jpeg': contentType = 'image/jpeg'; break;
            case '.png': contentType = 'image/png'; break;
            case '.gif': contentType = 'image/gif'; break;
            case '.webp': contentType = 'image/webp'; break;
            case '.bmp': contentType = 'image/bmp'; break;
        }

        res.setHeader('Content-Type', contentType);
        res.sendFile(fullPath);
    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/directories', async (req, res) => {
    try {
        const menus = await Menu.findAll();
        if (menus.length === 0) {
             res.json([]);
        } else {
             const tree = buildMenuTree(menus);
             res.json(tree);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch directories' });
    }
});

app.get('/api/images', (req, res) => {
    try {
        const dirParam = req.query.dir || '';
        const targetDir = path.join(IMAGE_DIR, dirParam);

        const normalizedTarget = path.normalize(targetDir);
        const normalizedBase = path.normalize(IMAGE_DIR);
        if (!normalizedTarget.startsWith(normalizedBase)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (!fs.existsSync(targetDir)) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        const files = fs.readdirSync(targetDir);
        const images = [];

        files.forEach(file => {
            const filePath = path.join(targetDir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    const ext = path.extname(file).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
                        images.push({
                            name: file,
                            path: filePath,
                            relativePath: path.relative(IMAGE_DIR, filePath).replace(/\\/g, '/'),
                            size: stat.size,
                            mtime: stat.mtime
                        });
                    }
                }
            } catch (e) { }
        });

        images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        res.json(images);
    } catch (error) {
        console.error('Error scanning directory:', error);
        res.status(500).json({ error: 'Failed to scan directory' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    logInfo('server started', {
        localUrl: `http://localhost:${PORT}`,
        networkUrl: `http://[your-ip]:${PORT}`
    });
});
