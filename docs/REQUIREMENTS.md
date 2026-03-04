# 图片浏览器项目 - 系统功能与需求说明

## 概览

本文件汇总系统功能、技术栈、项目结构与接口要点，便于快速理解系统。

## 功能特性

- 图片浏览：以目录树结构浏览图片。
- 后台管理：
  - 菜单管理：支持拖拽排序菜单，支持从现有目录结构一键生成菜单。
  - 文件夹管理：重命名、删除（带安全检查和确认延迟）、移动文件夹（拖拽至左侧菜单）、切换图片显示。
  - 封面设置：右键点击图片可将其设置为当前文件夹的封面。

## 技术栈

- 前端：Vue 3、Vite、vue-router、vuedraggable
- 后端：Node.js、Express、CORS
- 数据库：Sequelize（SQLite）

## 项目结构

- 根目录
  - server.js：后端服务与 REST API
  - db.js：Sequelize 初始化与模型定义
  - database.sqlite：SQLite 数据库文件（自动生成）
  - vite.config.js：Vite 配置（dev 端口 3000）
  - start_services.bat / stop_services.bat：一键启动/停止前后端
- src/
  - main.js：应用入口
  - App.vue：根组件（承载路由）
  - router/index.js：路由定义（/ 与 /admin）
  - components/
    - ImageGallery.vue：图片浏览页组件（首页）
    - DirectoryTree.vue：目录树组件（复用在首页导航）
    - AdminMenuTree.vue：管理页左侧菜单树组件（支持拖拽）
    - ToastMessage.vue：消息组件（预留）
  - views/
    - Admin.vue：后台管理页
  - assets/、public/：静态资源
  - style.css、index.html：样式与页面模板

## 功能详解

- 图片浏览页（/）
  - 左侧可收起的目录导航，使用保存的菜单树展示目录结构。
  - 选择目录后右侧一次加载 30 张，靠近底部自动继续加载（懒加载与无限滚动）。
  - 图片按文件名自然排序；加载失败的图片自动隐藏。
  - 支持快捷按钮收起/展开目录面板。
- 后台管理页（/admin）
  - 左侧菜单管理
    - 显示为树结构，支持拖拽排序、拖入子级。
    - 支持「新增根菜单」「删除」「重命名」。
    - 支持「重新扫描目录」按当前磁盘目录生成菜单树。
  - 右侧内容区
    - 上方面包屑定位当前路径，按钮可控制显示图片、显示文件名、手动刷新。
    - 文件夹以卡片形式展示，若已设置封面则显示封面图。
    - 图片支持分页（每页数量可在设置中调整），名称按需显示。
  - 文件拖拽移动
    - 可将右侧文件夹拖动到左侧某个菜单项，实现磁盘层级移动；同时后端自动同步更新菜单路径。
  - 删除确认
    - 删除文件夹前预统计子文件与文件夹数量；删除按钮带倒计时以防误操作。
  - 设置面板
    - 主题切换（深色/浅色）。
    - 每页图片数量。
    - 进入文件夹时是否默认显示图片。

### 右键菜单说明

- 在文件夹上右键：
  - 重命名
  - 删除
- 在图片上右键：
  - 重命名
  - 删除
  - 设置为封面（将该图设为当前文件夹封面）
- 在空白区域右键：
  - 批量增加前缀：为当前文件夹内所有图片文件名批量加上指定前缀

## 后端 API 概览

- 菜单
  - GET /api/menus：获取菜单树
  - POST /api/menus：新增菜单项
  - PUT /api/menus/:id：更新菜单项（名称、父级、顺序、路径）
  - DELETE /api/menus/:id：删除菜单项
  - POST /api/menus/scan：扫描磁盘目录生成菜单树
- 目录与文件
  - GET /api/folder-content?dir=xxx&page=&limit=：列出目录内容（文件夹与分页后的图片）
  - POST /api/file/rename：重命名文件/文件夹（文件夹会同步更新相关菜单路径）
  - POST /api/folder/move：移动文件夹到新的父目录（同步更新菜单路径）
  - GET /api/folder/stats?dir=xxx：删除前统计目录内文件与子文件夹
  - DELETE /api/folder?dir=xxx：删除目录（禁止删除根目录）
  - DELETE /api/file?path=xxx：删除文件
  - POST /api/folder/batch-prefix：为目录下图片批量添加文件名前缀
  - POST /api/folder/cover：设置目录封面
  - GET /api/image/:relativePath：按相对路径返回图片文件
  - GET /api/images?dir=xxx：返回目录下图片清单
- 设置
  - GET /api/settings：获取设置
  - POST /api/settings：保存设置项（主题、每页数量、默认是否显示图片等）

## 数据与路径

- 图片根目录：D:\DataStorage\open（可在 server.js 中修改 IMAGE_DIR）
- 数据库存储：
  - 菜单表 menus：树结构（id、name、path、parentId、order）
  - 设置表 settings：键值对（JSON 值）
  - 文件夹元数据表 folder_metadata：封面图、备注等

