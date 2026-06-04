# 漫画阅读器改造规划

## 目标

将当前图片浏览项目改造成一个个人使用的漫画阅读软件。第一阶段优先做好电脑浏览器访问和核心阅读体验，后续使用同一套前端打包 Android APK。

项目可以重写前台体验，后台管理暂时不作为主线。已有项目中有价值的部分保留为后端基础能力和后续管理能力。

## 产品方向

目标风格参考喵趣漫画一类移动端漫画软件：轻量、圆润、封面卡片化、沉浸式阅读、操作入口少、阅读路径直接。

核心体验：

- 打开后首先看到漫画书架，而不是文件夹树。
- 支持最近阅读、继续阅读、搜索、分类。
- 漫画详情页展示封面、标题、阅读进度和章节列表。
- 阅读页默认沉浸式，图片连续纵向滚动。
- 大图允许慢慢加载，但页面滚动和主流程不能卡顿。
- 一套前端同时适配手机尺寸、平板尺寸和电脑浏览器。

## 技术路线

### 前端

推荐重写前端主体验：

- Vue 3
- TypeScript
- Vite
- vue-router
- Pinia
- TanStack Virtual
- Capacitor

原因：

- 当前项目已经是 Vue + Vite，迁移成本低。
- Vue 可以同时服务浏览器和 Android WebView。
- Capacitor 适合后续将同一套 Web 前端打包成 APK。
- TanStack Virtual 用于章节阅读页的长列表和动态尺寸图片渲染。

不建议第一阶段切到 Android 原生 Kotlin。原生性能更好，但会导致 PC 端和 Android 端维护两套 UI。个人项目第一版优先保证迭代速度。

### 后端

推荐保留 Node.js + Express + SQLite，但重构为漫画领域模型：

- Express 继续提供 API。
- SQLite 保存漫画索引、章节、页面、阅读进度、分类和设置。
- 后续增加 sharp 读取图片尺寸、生成缩略图。
- 当前文件操作能力可保留给后台管理阶段复用。

SQLite 数据库创建逻辑可以重写。新版数据库默认放在项目根目录：

```text
D:\item\MangaNest\database.sqlite
```

后端启动时应从项目根目录解析数据库路径，而不是默认写入 backend 目录。旧数据库结构不需要强行兼容；如果进入漫画阅读器重写阶段，可以创建新的数据库表结构并提供重新扫描漫画库的能力。

## 保留内容

当前项目中建议保留：

- backend/server.js 中的 Express 服务基础。
- backend/db.js 中的 SQLite/Sequelize 初始化思路。
- 图片按相对路径访问的 API 设计思路。
- 设置表的 key-value 存储思路。
- 文件夹扫描目录的能力，但要改造成漫画库扫描。
- 文件重命名、删除、移动等维护能力，后续后台管理复用。
- frontend 的 Vite 项目结构。
- vue-router 的页面组织方式。
- ToastMessage/message 插件可以保留或重写为新版提示组件。

## 暂时放弃或降级内容

第一阶段不优先保留：

- 当前首页 ImageGallery 的文件夹树浏览模式。
- 当前后台 Admin.vue 的完整拖拽菜单管理体验。
- 当前 DirectoryTree/AdminMenuTree 的菜单树作为主导航。
- 当前图片一次加载大量原图的方式。
- 当前以菜单 path 作为核心数据模型的思路。

这些内容不是立即删除，而是先不作为新版主线。后台管理可以在阅读器稳定后再重新设计。

## 漫画存储结构

第一版支持文件夹漫画库。

推荐目录结构：

```text
MangaLibrary/
  漫画A/
    cover.jpg
    第001话 冒险开始/
      0001.jpg
      0002.jpg
      0003.jpg
    第002话 新的旅程/
      0001.jpg
      0002.jpg

  漫画B/
    cover.jpg
    001/
      0001.webp
      0002.webp
```

后续可以扩展支持 CBZ：

```text
MangaLibrary/
  漫画C/
    cover.jpg
    001.cbz
    002.cbz
```

目录约定：

- 一级目录是漫画。
- 二级目录是章节。
- 章节内图片按自然排序作为页序。
- cover.jpg/png/webp 优先作为漫画封面。
- 没有封面时使用第一章第一页作为默认封面。

## 数据库模型

建议建立漫画领域表。

数据库文件位置：

```text
database.sqlite
```

该文件位于项目根目录 `D:\item\MangaNest`。后端代码应显式使用项目根目录作为 SQLite 存储位置，避免同一项目下出现多个数据库文件。

```text
comics
  id
  title
  author
  coverPath
  description
  status
  sourcePath
  createdAt
  updatedAt

chapters
  id
  comicId
  title
  number
  path
  type
  pageCount
  sortOrder
  createdAt
  updatedAt

pages
  id
  chapterId
  pageIndex
  filePath
  width
  height
  thumbPath
  fileSize
  hash

reading_progress
  id
  comicId
  chapterId
  pageIndex
  scrollOffset
  updatedAt

categories
  id
  name
  sortOrder

comic_categories
  comicId
  categoryId

settings
  key
  value
```

关键点：

- pages.width 和 pages.height 必须缓存。
- 前端依赖宽高比例提前渲染占位坑位。
- 阅读进度保存到 chapterId、pageIndex 和 scrollOffset。
- 分类和阅读进度独立于磁盘目录，后续移动文件也更容易维护。

## 后端 API 规划

漫画库：

```text
GET  /api/library/comics
GET  /api/library/comics/:id
GET  /api/library/comics/:id/chapters
POST /api/library/scan
```

章节阅读：

```text
GET /api/chapters/:id
GET /api/chapters/:id/pages
GET /api/pages/:id/image
GET /api/pages/:id/thumb
```

阅读进度：

```text
GET  /api/progress
PUT  /api/progress
GET  /api/recent
```

分类：

```text
GET  /api/categories
POST /api/categories
PUT  /api/categories/:id
POST /api/comics/:id/categories
```

设置：

```text
GET  /api/settings
POST /api/settings
```

后续后台维护：

```text
POST   /api/files/rename
DELETE /api/files
POST   /api/folders/move
POST   /api/comics/:id/cover
```

## 前端页面规划

### 书架页

路径：/

内容：

- 顶部搜索框。
- 最近阅读横向列表。
- 漫画封面网格。
- 分类筛选入口。
- 每本漫画显示封面、标题、阅读进度。

移动端使用底部导航，电脑端使用左侧导航。

### 漫画详情页

路径：/comic/:id

内容：

- 漫画封面和标题。
- 最近阅读状态。
- 继续阅读按钮。
- 章节列表。
- 分类、收藏、刷新信息入口。

### 阅读页

路径：/reader/:chapterId

内容：

- 默认纵向连续滚动。
- 点击屏幕显示或隐藏工具栏。
- 顶部显示返回、标题、设置。
- 底部显示章节进度、上一章、下一章。
- 自动保存阅读进度。
- 图片按坑位和虚拟列表加载。

### 设置页

路径：/settings

内容：

- 漫画库路径。
- 后端地址。
- 主题。
- 阅读方向。
- 图片加载并发数。
- 缩略图缓存管理。
- 重新扫描漫画库。

## 图片加载方案

当前项目最大的问题是将大量原图直接加入页面，导致网络、解码、布局和 DOM 数量一起压到主流程。

新版阅读页必须采用坑位加载：

1. 进入章节后只请求页面元数据。
2. 根据 width/height 计算占位比例。
3. 先渲染固定高度坑位。
4. 使用虚拟列表只保留视口附近 DOM。
5. 使用 IntersectionObserver 或虚拟列表范围变化触发加载。
6. 图片并发控制为 2 到 4 张。
7. 当前视口前后预加载 2 到 3 页。
8. 原图加载前显示缩略图或纯色骨架。
9. 图片加载完成后淡入。
10. 距离视口很远的图片释放原图 DOM，只保留坑位。

这样可以保证：

- 图片大时加载慢，但页面不阻塞。
- 滚动过程不卡。
- 长章节不会因为 DOM 过多导致内存持续上涨。
- 图片尺寸变化不会造成严重布局抖动。

## APK 打包规划

第一版 Android APK 使用 Capacitor。

模式：

- 前端仍然是 Vue Web App。
- APK 内运行同一套页面。
- 后端地址可以配置为电脑局域网 IP。
- 个人使用时，手机和电脑在同一网络即可访问漫画库。

后续增强：

- 支持手机本地漫画目录。
- 支持离线缓存。
- 支持 Android 文件选择器。
- 支持系统返回键、全屏、屏幕常亮。

短期不优先支持手机直接维护漫画文件。文件维护先放在电脑后端和浏览器后台。

## 分阶段实施

### 第一阶段：漫画阅读前台

目标：让项目从图片浏览器变成漫画阅读器。

内容：

- 新建漫画库数据库模型。
- 新增漫画目录扫描。
- 新增漫画列表、详情、章节页面 API。
- 重写首页为书架页。
- 新增漫画详情页。
- 新增阅读页。
- 实现坑位加载、虚拟滚动、阅读进度。

完成标准：

- 浏览器可以打开书架。
- 可以进入漫画详情。
- 可以进入章节阅读。
- 大图加载时页面仍可流畅滚动。
- 刷新后可以恢复最近阅读位置。

### 第二阶段：体验完善

目标：接近常规漫画 App 使用体验。

内容：

- 最近阅读。
- 分类/收藏。
- 搜索。
- 阅读设置。
- 主题。
- 缩略图生成。
- 封面识别。
- 章节排序规则优化。

完成标准：

- 日常阅读不依赖后台管理页。
- 漫画库数量增加后仍能快速查找。
- 封面和进度显示稳定。

### 第三阶段：Android APK

目标：同一前端打包为个人使用 APK。

内容：

- 接入 Capacitor。
- Android 全屏阅读适配。
- 后端地址配置。
- 返回键处理。
- Android WebView 性能检查。
- 打包 APK。

完成标准：

- APK 可以连接电脑后端。
- 手机上可以浏览书架、阅读章节、保存进度。
- 阅读页手势和返回行为符合移动端习惯。

### 第四阶段：后台管理重构

目标：提供漫画文件维护能力。

内容：

- 漫画库扫描状态。
- 文件重命名。
- 章节移动。
- 删除。
- 设置封面。
- 修复元数据。
- 手动调整章节排序。

完成标准：

- 后台围绕漫画、章节、页面维护，而不是围绕通用目录树维护。

## 开源项目参考

可参考但不直接照搬：

- Mihon：Android 原生漫画阅读器，适合参考漫画阅读器的信息架构、阅读模式、分类、进度和备份思路。
- Kotatsu：适合参考移动端漫画阅读体验、封面网格、本地阅读和 CBZ 支持。

喵趣漫画目前未找到可信源码仓库，因此只参考其界面和体验风格，不直接使用源码。

## 当前项目迁移策略

建议不要在旧 ImageGallery 和 Admin.vue 上继续堆功能。

推荐方式：

1. 保留旧页面作为临时参考。
2. 新建新版前台页面和 API。
3. 新版阅读体验跑通后，将默认路由切换到书架页。
4. 旧后台暂时保留但隐藏入口。
5. 后台管理阶段再按漫画领域模型重写。

## 优先级

最高优先级：

- 漫画库扫描。
- 漫画书架。
- 漫画详情。
- 高性能阅读页。
- 阅读进度。

中优先级：

- 搜索。
- 分类。
- 最近阅读。
- 缩略图。
- 主题。

低优先级：

- 完整后台管理。
- CBZ。
- 手机本地离线漫画库。
- 云同步。
- 在线漫画源。

## 关键原则

- 先做好阅读体验，再做管理体验。
- 先支持本地/局域网个人使用，再考虑更复杂的同步和离线能力。
- 页面不能因为图片大而卡顿。
- 数据模型必须从文件夹浏览转为漫画、章节、页面。
- Android APK 第一版使用同一套 Web 前端，降低维护成本。
