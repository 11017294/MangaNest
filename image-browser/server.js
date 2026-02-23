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

// 获取所有图片文件
app.get('/api/images', (req, res) => {
    try {
        const images = [];

        function scanDirectory(dir) {
            const files = fs.readdirSync(dir);

            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    // 递归扫描子目录
                    scanDirectory(filePath);
                } else {
                    // 检查是否为图片文件
                    const ext = path.extname(file).toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
                        images.push({
                            name: file,
                            path: filePath,
                            relativePath: path.relative(IMAGE_DIR, filePath),
                            size: stat.size,
                            mtime: stat.mtime
                        });
                    }
                }
            });
        }

        scanDirectory(IMAGE_DIR);

        // 按修改时间排序，最新的在前面
        images.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

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
