
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, Menu, Setting, FolderMetadata, initDB } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Initialize DB
initDB();

app.use(cors());
app.use(express.json());

// Base image directory
const IMAGE_DIR = 'D:\\DataStorage\\open';

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

        for (const item of items) {
            if (item.isDirectory()) {
                const relPath = path.relative(IMAGE_DIR, path.join(targetDir, item.name)).replace(/\\/g, '/');
                folders.push({
                    name: item.name,
                    path: relPath,
                    coverImage: metadataMap[relPath] || null
                });
            } else if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
                    images.push({
                        name: item.name,
                        relativePath: path.relative(IMAGE_DIR, path.join(targetDir, item.name)).replace(/\\/g, '/')
                    });
                }
            }
        }

        folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

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
        settings.forEach(s => settingsMap[s.key] = s.value);
        res.json(settingsMap);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { key, value } = req.body;
        const [setting, created] = await Setting.findOrCreate({
            where: { key },
            defaults: { value }
        });
        if (!created) {
            setting.value = value;
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
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Access from other devices: http://[your-ip]:${PORT}`);
});
