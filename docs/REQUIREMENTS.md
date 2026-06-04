# 漫栖 MangaNest - 系统功能与需求说明

## 概览

漫栖 MangaNest 是个人本地漫画阅读与管理系统。项目采用一个后端、两个前端：

- `backend`：Express + Sequelize + SQLite，负责漫画索引、图片读取、阅读记录、分类和文件管理接口。
- `frontend`：漫画阅读端，面向浏览器访问，后续可通过 Capacitor 打包 Android APK。
- `frontend-admin`：漫画管理端，面向浏览器访问，用于维护漫画库、目录、封面、分类和索引。

## 功能特性

阅读端：

- 首页漫画列表。
- 书架收藏与历史记录。
- 排行榜与分类浏览。
- 漫画详情、章节列表和继续阅读。
- 连续纵向阅读图片。
- 自动保存阅读进度。
- 夜间模式与图片加载设置。

管理端：

- 设置漫画库根目录。
- 扫描并重建漫画索引。
- 浏览漫画库真实目录。
- 重命名目录和图片文件。
- 拖拽真实移动目录。
- 删除目录和图片文件。
- 图片预览与封面设置。
- 分类新增、重命名、删除。
- 给漫画分配分类。

## 技术栈

- 后端：Node.js、Express、Sequelize、SQLite。
- 阅读端：Vue 3、Vite、vue-router、Axios、Capacitor。
- 管理端：Vue 3、Vite、vuedraggable。
- 测试：Node.js `node --test`。

## 项目结构

```text
MangaNest/
  backend/            后端服务与数据库模型
  frontend/           漫画阅读端
  frontend-admin/     漫画管理端
  test/               后端与前端工具测试
  docs/               规划与说明文档
  database.sqlite     本地 SQLite 数据库，自动生成，不提交
```

## 运行入口

后端：

```powershell
cd D:\item\MangaNest\backend
npm install
npm run server
```

阅读端：

```powershell
cd D:\item\MangaNest\frontend
npm install
npm run dev -- --host 0.0.0.0
```

管理端：

```powershell
cd D:\item\MangaNest\frontend-admin
npm install
npm run dev -- --host 0.0.0.0
```

默认地址：

- 阅读端：http://localhost:3000/
- 管理端：http://localhost:3002/
- 后端：http://localhost:3001/

## 漫画库结构

推荐结构：

```text
漫画库/
  漫画A/
    cover.jpg
    第001话/
      001.webp
      002.webp
  漫画B/
    001.webp
    002.webp
```

漫画库根目录下的每个一级子目录会识别为一部漫画。漫画目录下直接放图片时，会识别为单章节漫画。

## 提交规则

应提交：

- 源码、测试、文档。
- 各子项目 `package-lock.json`。
- Capacitor Android 工程源码和 Gradle wrapper。

不应提交：

- `node_modules/`
- `dist/`
- `build/`
- `.gradle/`
- `.idea/`
- `.vscode/`
- `database.sqlite`
- 日志、临时验证脚本、本机配置文件。
