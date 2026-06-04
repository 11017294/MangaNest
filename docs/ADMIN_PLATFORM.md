# 管理平台说明

本项目现在采用一个后端、两个前端：

- `backend`：共用 SQLite、漫画索引、图片和文件管理接口。
- `frontend`：阅读端，浏览器访问，后续可打包 APK。
- `frontend-admin`：管理端，浏览器访问，用于维护漫画库和索引。

## 启动

后端：

```powershell
cd D:\item\MangaNest\backend
npm run server
```

阅读端：

```powershell
cd D:\item\MangaNest\frontend
npm run dev -- --host 0.0.0.0
```

管理端：

```powershell
cd D:\item\MangaNest\frontend-admin
npm run dev -- --host 0.0.0.0
```

默认访问地址：

- 阅读端：http://127.0.0.1:3000/
- 管理端：http://127.0.0.1:3002/
- 后端：http://127.0.0.1:3001/

## 管理端第一版功能

- 设置漫画库路径。
- 扫描漫画库并重建索引。
- 浏览当前漫画库目录。
- 重命名目录和图片文件。
- 删除目录和图片文件。
- 拖拽文件夹到另一个文件夹，实现真实磁盘目录移动。
- 设置当前目录封面。
- 预览图片。
- 维护漫画封面、收藏状态、索引删除。
- 管理分类，并给漫画分配分类。

真实文件操作都限制在当前 `libraryPath` 内。移动、重命名、删除后建议重新扫描索引。
