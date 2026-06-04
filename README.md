# 漫栖 MangaNest

漫栖 MangaNest 是一个个人本地漫画阅读与管理系统。项目采用一个后端、两个前端：

- `backend`：Express + SQLite 后端，负责漫画索引、图片读取、阅读记录和管理接口。
- `frontend`：阅读端，可在浏览器访问，后续可打包成 Android APK。
- `frontend-admin`：管理端，浏览器访问，用于维护漫画库、目录、分类和索引。

## 启动

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

默认访问地址：

- 阅读端：http://localhost:3000/
- 管理端：http://localhost:3002/
- 后端：http://localhost:3001/

## 主要功能

阅读端：

- 首页漫画列表
- 书架收藏与历史
- 排行榜与分类浏览
- 漫画详情与章节列表
- 图片阅读器
- 自动保存阅读进度
- 夜间模式与阅读加载设置

管理端：

- 设置漫画库根目录
- 扫描并重建漫画索引
- 浏览漫画库目录
- 重命名目录和图片文件
- 拖拽真实移动目录
- 删除目录和图片文件
- 图片预览与封面设置
- 漫画封面、收藏、索引维护
- 分类新增、重命名、删除
- 给漫画分配分类

## 测试

测试文件统一放在 `test` 目录下。

```powershell
npm test
```

## 漫画库结构

支持常见结构：

```text
漫画库/
  漫画A/
    第1话/
      001.webp
      002.webp
  漫画B/
    001.webp
    002.webp
```

当漫画目录下直接放图片时，会识别为单章节漫画。

## 数据

- SQLite 数据库：`database.sqlite`
- 漫画库路径：通过管理端设置，保存在 settings 表中。
- 管理端真实文件操作限制在当前漫画库根目录内。
