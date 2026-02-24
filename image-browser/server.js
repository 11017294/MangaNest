import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// 允许跨域
app.use(cors());

// 图片目录路径
const IMAGE_DIR = 'D:\\DataStorage\\open';

// 获取目录树（只获取目录结构）
app.get('/api/directories', (req, res) => {
    try {
        const getDirTree = (currentPath) => {
            let items;
            try {
                items = fs.readdirSync(currentPath, { withFileTypes: true });
            } catch (e) {
                // 如果无法读取目录（如权限不足），则返回空
                return [];
            }
            
            const dirs = [];

            items.forEach(item => {
                if (item.isDirectory()) {
                    const fullPath = path.join(currentPath, item.name);
                    dirs.push({
                        name: item.name,
                        path: path.relative(IMAGE_DIR, fullPath).replace(/\\/g, '/'),
                        fullPath: fullPath
                    });
                }
            });

            // Windows 文件名自然排序
            dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

            return dirs.map(dir => ({
                name: dir.name,
                path: dir.path,
                children: getDirTree(dir.fullPath)
            }));
        };

        const tree = getDirTree(IMAGE_DIR);
        res.json(tree);
    } catch (error) {
        console.error('Error scanning directories:', error);
        res.status(500).json({ error: 'Failed to scan directories' });
    }
});

// 获取指定目录下的图片
app.get('/api/images', (req, res) => {
    try {
        const dirParam = req.query.dir || '';
        const targetDir = path.join(IMAGE_DIR, dirParam);

        // 安全检查
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
            } catch (e) {
                // 忽略错误
            }
        });

        // 按文件名自然升序排序
        images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        res.json(images);
    } catch (error) {
        console.error('Error scanning directory:', error);
        res.status(500).json({ error: 'Failed to scan directory' });
    }
});

// 提供图片文件服务
app.get('/api/image/:imagePath(*)', (req, res) => {
    try {
        const imagePath = req.params.imagePath;
        const fullPath = path.join(IMAGE_DIR, imagePath);

        // 安全检查：确保请求的文件在指定目录内
        const normalizedPath = path.normalize(fullPath);
        const normalizedBase = path.normalize(IMAGE_DIR);

        if (!normalizedPath.startsWith(normalizedBase)) {
            return res.status(403).send('Forbidden');
        }

        // 检查文件是否存在
        if (!fs.existsSync(fullPath)) {
            return res.status(404).send('File not found');
        }

        // 设置适当的Content-Type
        const ext = path.extname(fullPath).toLowerCase();
        let contentType = 'application/octet-stream';

        switch (ext) {
            case '.jpg':
            case '.jpeg':
                contentType = 'image/jpeg';
                break;
            case '.png':
                contentType = 'image/png';
                break;
            case '.gif':
                contentType = 'image/gif';
                break;
            case '.webp':
                contentType = 'image/webp';
                break;
            case '.bmp':
                contentType = 'image/bmp';
                break;
        }

        res.setHeader('Content-Type', contentType);
        res.sendFile(fullPath);
    } catch (error) {
        console.error('Error serving image:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Access from other devices: http://[your-ip]:${PORT}`);
});
