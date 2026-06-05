<template>
  <main class="admin-shell" @click="closeContextMenu">
    <aside class="sidebar">
      <div class="brand">
        <strong>目录导航</strong>
        <span>{{ currentPath || '漫画库根目录' }}</span>
      </div>

      <section class="panel">
        <div class="panel-title">
          <h2>目录</h2>
          <button class="text-button" @click="openFolder('')">根目录</button>
        </div>
        <div class="breadcrumbs">
          <button
            v-for="crumb in breadcrumbs"
            :key="crumb.path"
            :class="{ active: crumb.path === currentPath }"
            @click="openFolder(crumb.path)"
          >
            {{ crumb.name }}
          </button>
        </div>
        <div class="folder-nav">
          <button
            v-for="dir in folder.folders"
            :key="dir.path"
            @click="openFolder(dir.path)"
          >
            {{ dir.name }}
          </button>
        </div>
      </section>
    </aside>

    <section class="workspace">
      <header class="workspace-header">
        <div>
          <span class="eyebrow">File Manager</span>
          <h1>{{ currentPath || '漫画库根目录' }}</h1>
        </div>
        <div class="header-actions">
          <button class="secondary-button" @click="loadAll">刷新</button>
        </div>
      </header>
      <p v-if="message" class="message workspace-message">{{ message }}</p>

      <nav class="admin-menu-bar" aria-label="管理菜单">
        <button :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">文件</button>
        <button :class="{ active: activeTab === 'comics' }" @click="activeTab = 'comics'">漫画</button>
        <button :class="{ active: activeTab === 'categories' }" @click="activeTab = 'categories'">分类</button>
        <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">设置</button>
      </nav>

      <section v-if="activeTab === 'files'" class="panel content-panel">
        <div class="panel-title">
          <h2>文件管理</h2>
          <span>{{ folder.folders.length }} 个目录 · {{ folder.images.length }} 张图片</span>
        </div>

        <div v-if="folderLoading" class="empty-state">加载目录...</div>
        <div v-else class="file-grid">
          <article
            v-for="dir in folder.folders"
            :key="dir.path"
            class="folder-card"
            draggable="true"
            @contextmenu.prevent.stop="openFileContextMenu($event, dir, 'folder')"
            @dragstart="startDragFolder(dir)"
            @dragover.prevent
            @drop.prevent="dropFolder(dir)"
          >
            <button class="thumb folder-thumb" @click="openFolder(dir.path)">
              <img v-if="dir.coverImage" :src="imageUrl(dir.coverImage)" alt="" loading="lazy" />
              <span v-else>无图片</span>
              <small class="type-badge" aria-label="文件夹">DIR</small>
            </button>
            <input
              :value="dir.name"
              class="name-input"
              @change="renamePath(dir.path, $event.target.value)"
            />
          </article>

          <article
            v-for="image in folder.images"
            :key="image.path"
            class="image-card"
            @contextmenu.prevent.stop="openFileContextMenu($event, image, 'image')"
          >
            <button class="thumb" @click="openFolderImagePreview(image)">
              <img :src="imageUrl(image.path)" :alt="image.name" loading="lazy" />
            </button>
            <input
              :value="image.name"
              class="name-input"
              @change="renamePath(image.path, $event.target.value)"
            />
          </article>
        </div>
      </section>

      <section v-if="activeTab === 'comics'" class="panel content-panel">
        <div class="panel-title">
          <h2>漫画管理</h2>
          <span>{{ filteredComics.length }} 本</span>
        </div>
        <input v-model="comicQuery" class="search-input" placeholder="搜索漫画标题" />
        <div class="bulk-toolbar">
          <label class="select-all-control">
            <input type="checkbox" :checked="allFilteredSelected" @change="toggleAllFilteredComics($event.target.checked)" />
            全选
          </label>
          <button class="danger-button" :disabled="!selectedComicIds.length" @click="removeSelectedComicIndexes">
            批量删除索引
          </button>
          <span>{{ selectedComicIds.length }} 项已选</span>
        </div>
        <div class="comic-table">
          <article
            v-for="comic in filteredComics"
            :key="comic.id"
            class="comic-row"
            @contextmenu.prevent.stop="openComicContextMenu($event, comic)"
          >
            <input
              class="comic-select"
              type="checkbox"
              :checked="selectedComicIds.includes(comic.id)"
              @change="toggleComicSelection(comic.id, $event.target.checked)"
            />
            <button class="comic-cover-button" @click="openComicImages(comic, 'view')">
              <img v-if="comic.coverPath" :src="imageUrl(comic.coverPath)" alt="" loading="lazy" />
              <span v-else>无封面</span>
            </button>
            <div class="comic-main">
              <strong>{{ comic.title }}</strong>
              <span>{{ comic.chapterCount }} 章</span>
              <div class="comic-category-summary">
                <span
                  v-for="category in comic.categories || []"
                  :key="category.id"
                  class="comic-category-chip"
                >
                  {{ category.name }}
                </span>
                <span v-if="!comic.categories?.length" class="muted-chip">未分类</span>
              </div>
            </div>
            <div class="comic-actions">
              <button @click="openCategoryDialog(comic)">管理分类</button>
              <button @click="openComicImages(comic, 'view')">显示图片</button>
              <button @click="openComicImages(comic, 'cover')">设置封面</button>
              <button class="danger-button" @click="removeComicIndex(comic)">删索引</button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="activeTab === 'categories'" class="panel content-panel" @contextmenu.prevent="openCategoryListContextMenu($event)">
        <div class="panel-title">
          <h2>分类管理</h2>
          <span>{{ categories.length }} 个</span>
        </div>
        <div class="category-toolbar">
          <button class="primary-button" @click="openCreateCategoryDialog()">新增分类</button>
        </div>
        <div class="category-list">
          <article
            v-for="(category, index) in categories"
            :key="category.id"
            class="category-row"
            @contextmenu.prevent.stop="openCategoryContextMenu($event, category, index)"
          >
            <div class="sort-actions">
              <button :disabled="index === 0" @click="moveCategory(index, -1)">上移</button>
              <button :disabled="index === categories.length - 1" @click="moveCategory(index, 1)">下移</button>
            </div>
            <input :value="category.name" @change="renameCategory(category, $event.target.value)" />
            <button class="danger-text" @click="removeCategory(category)">删除</button>
          </article>
        </div>
      </section>

      <section v-if="activeTab === 'settings'" class="panel content-panel settings-panel">
        <div class="panel-title">
          <h2>系统设置</h2>
          <span>漫画库根目录与索引</span>
        </div>
        <section class="library-console settings-console">
          <div class="library-copy">
            <span class="eyebrow">Library Root</span>
            <h1>漫画库根目录</h1>
            <p>{{ folder.libraryPath || libraryPathDraft || '还没有设置漫画库根目录' }}</p>
          </div>
          <div class="library-controls">
            <label>
              <span>本机绝对路径</span>
              <input
                v-model="libraryPathDraft"
                placeholder="例如 D:\\MangaLibrary"
                @keyup.enter="saveLibraryPath"
              />
            </label>
            <div class="library-actions">
              <button class="primary-button" @click="saveLibraryPath">保存根目录</button>
              <button class="secondary-button" :disabled="scanning" @click="scan">
                {{ scanning ? '扫描中' : '扫描并重建索引' }}
              </button>
            </div>
          </div>
        </section>
      </section>
    </section>

    <div v-if="previewImage" class="preview-overlay" @click.self="closePreview" @wheel.prevent="handlePreviewWheel">
      <button class="preview-close" @click="closePreview">关闭</button>
      <button
        v-if="canPreviewPrevious"
        class="preview-nav preview-prev"
        aria-label="上一张"
        @click.stop="shiftPreview(-1)"
      >
        ‹
      </button>
      <button
        v-if="canPreviewNext"
        class="preview-nav preview-next"
        aria-label="下一张"
        @click.stop="shiftPreview(1)"
      >
        ›
      </button>
      <div class="preview-click-zone preview-click-prev" @click.stop="shiftPreview(-1)"></div>
      <div class="preview-click-zone preview-click-next" @click.stop="shiftPreview(1)"></div>
      <img :src="imageUrl(previewImage.path)" :alt="previewImage.name" @click.stop />
      <div class="preview-caption">
        <strong>{{ previewImage.name }}</strong>
        <span>{{ previewPositionLabel }}</span>
      </div>
    </div>

    <div v-if="deleteConfirmDialog.open" class="delete-confirm-overlay" @click.self="closeDeleteConfirmDialog">
      <section class="delete-confirm-dialog">
        <header class="image-dialog-header">
          <div>
            <span class="eyebrow">Delete</span>
            <h2>确认删除{{ deleteConfirmDialog.type === 'folder' ? '文件夹' : '文件' }}</h2>
          </div>
          <button class="secondary-button" :disabled="deleteConfirmDialog.submitting" @click="closeDeleteConfirmDialog">关闭</button>
        </header>
        <div class="delete-confirm-body">
          <p class="delete-warning">这个操作会直接删除磁盘上的{{ deleteConfirmDialog.type === 'folder' ? '文件夹及其中所有内容' : '文件' }}，无法在应用内恢复。</p>
          <strong>{{ deleteConfirmDialog.name }}</strong>
          <small>{{ deleteConfirmDialog.path }}</small>
          <div class="delete-confirm-actions">
            <button class="secondary-button" :disabled="deleteConfirmDialog.submitting" @click="closeDeleteConfirmDialog">取消</button>
            <button
              class="danger-button"
              :disabled="deleteConfirmDialog.secondsRemaining > 0 || deleteConfirmDialog.submitting"
              @click="confirmDeletePath"
            >
              <span v-if="deleteConfirmDialog.submitting">删除中...</span>
              <span v-else-if="deleteConfirmDialog.secondsRemaining > 0">确认删除 {{ deleteConfirmDialog.secondsRemaining }}s</span>
              <span v-else>确认删除</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="comicImageDialog.open" class="image-dialog-overlay" @click.self="closeComicImageDialog">
      <section class="image-dialog">
        <header class="image-dialog-header">
          <div>
            <span class="eyebrow">{{ comicImageDialog.mode === 'cover' ? 'Choose Cover' : 'Images' }}</span>
            <h2>{{ comicImageDialog.comic?.title }}</h2>
          </div>
          <button class="secondary-button" @click="closeComicImageDialog">关闭</button>
        </header>
        <div class="image-dialog-body">
          <aside class="chapter-sidebar">
            <button
              v-for="chapter in comicImageDialog.chapters"
              :key="chapter.id"
              :class="{ active: comicImageDialog.activeChapterId === chapter.id }"
              @click="selectDialogChapter(chapter)"
            >
              <strong>{{ chapter.title }}</strong>
              <span>{{ chapter.pageCount || 0 }} 页</span>
            </button>
          </aside>
          <section class="dialog-pages">
            <div v-if="comicImageDialog.pageLoading" class="empty-state">加载图片...</div>
            <div v-else-if="!comicImageDialog.pages.length" class="empty-state">这个章节没有图片</div>
            <div v-else class="dialog-page-grid">
              <button
                v-for="page in comicImageDialog.pages"
                :key="page.id"
                class="dialog-page-tile"
                :class="{ selected: isCurrentComicCover(page), 'cover-mode': comicImageDialog.mode === 'cover' }"
                @click="comicImageDialog.mode === 'cover' ? chooseCoverPage(page) : previewPage(page)"
                @contextmenu.prevent.stop="openDialogPageContextMenu($event, page)"
              >
                <img :src="imageUrl(page.filePath)" :alt="page.name" loading="lazy" />
                <span>{{ page.name }}</span>
                <small v-if="isCurrentComicCover(page)" class="cover-selected-label">当前封面</small>
                <small v-else-if="comicImageDialog.mode === 'cover'" class="cover-set-label">点击设为封面</small>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>

    <div v-if="categoryDialog.open" class="category-dialog-overlay" @click.self="closeCategoryDialog">
      <section class="category-dialog">
        <header class="image-dialog-header">
          <div>
            <span class="eyebrow">Categories</span>
            <h2>{{ categoryDialog.comic?.title }}</h2>
          </div>
          <button class="secondary-button" @click="closeCategoryDialog">关闭</button>
        </header>
        <div class="category-dialog-body">
          <div v-if="!categories.length" class="empty-state compact">还没有分类，可以先新建一个。</div>
          <div v-else class="category-dialog-list">
            <label v-for="category in categories" :key="category.id" class="category-option">
              <input
                type="checkbox"
                :checked="categoryDialog.selectedIds.includes(category.id)"
                @change="toggleCategoryDialogSelection(category.id, $event.target.checked)"
              />
              <span>{{ category.name }}</span>
            </label>
          </div>
          <div class="category-dialog-footer">
            <button class="secondary-button" @click="openCreateCategoryDialog({ attachToCurrentComic: true })">新建分类</button>
            <button class="primary-button" @click="saveAndCloseCategoryDialog">保存分类</button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="createCategoryDialog.open" class="category-dialog-overlay" @click.self="closeCreateCategoryDialog">
      <section class="category-dialog create-category-dialog">
        <header class="image-dialog-header">
          <div>
            <span class="eyebrow">New Category</span>
            <h2>新增分类</h2>
          </div>
          <button class="secondary-button" @click="closeCreateCategoryDialog">关闭</button>
        </header>
        <form class="create-category-form" @submit.prevent="saveCreateCategoryDialog">
          <label>
            <span>分类名</span>
            <input v-model="createCategoryDialog.name" placeholder="分类名" />
          </label>
          <label>
            <span>排序号</span>
            <input v-model.number="createCategoryDialog.sortOrder" type="number" min="0" step="1" placeholder="排序号" />
          </label>
          <p v-if="createCategoryDialog.error" class="form-error">{{ createCategoryDialog.error }}</p>
          <div class="category-dialog-footer">
            <button class="secondary-button" type="button" @click="closeCreateCategoryDialog">取消</button>
            <button class="primary-button" type="submit">创建分类</button>
          </div>
        </form>
      </section>
    </div>

    <div
      v-if="contextMenu.open"
      class="context-menu"
      :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <div class="context-menu-title">{{ contextMenu.title }}</div>
      <button
        v-for="item in contextMenu.items"
        :key="item.label"
        :class="{ danger: item.danger }"
        :disabled="item.disabled"
        @click="runContextAction(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  createCategory,
  deleteCategory,
  deleteComicIndex,
  deleteFile,
  fetchChapterPages,
  fetchCategories,
  fetchComic,
  fetchComics,
  fetchFolder,
  fetchSettings,
  imageUrl,
  moveFolder,
  renameFile,
  revealFile,
  scanLibrary,
  setComicCategories,
  setComicCover,
  setFolderCover,
  updateCategory,
  updateSetting
} from './services/api'

const activeTab = ref('files')
const currentPath = ref('')
const libraryPathDraft = ref('')
const message = ref('')
const scanning = ref(false)
const folderLoading = ref(false)
const draggedFolder = ref(null)
const previewImage = ref(null)
const previewList = ref([])
const previewIndex = ref(-1)
const lastPreviewWheelAt = ref(0)
const comicQuery = ref('')
const comics = ref([])
const categories = ref([])
const selectedComicIds = ref([])
const comicImageDialog = reactive({
  open: false,
  mode: 'view',
  comic: null,
  chapters: [],
  activeChapterId: null,
  pages: [],
  pageLoading: false
})
const categoryDialog = reactive({
  open: false,
  comic: null,
  selectedIds: []
})
const createCategoryDialog = reactive({
  open: false,
  name: '',
  sortOrder: 0,
  error: '',
  attachToCurrentComic: false
})
const deleteConfirmDialog = reactive({
  open: false,
  path: '',
  name: '',
  type: 'file',
  secondsRemaining: 0,
  submitting: false,
  timerId: null
})
const contextMenu = reactive({
  open: false,
  x: 0,
  y: 0,
  title: '',
  items: []
})
const folder = reactive({
  libraryPath: '',
  folders: [],
  images: []
})

const breadcrumbs = computed(() => {
  const crumbs = [{ name: '根目录', path: '' }]
  if (!currentPath.value) return crumbs
  const parts = currentPath.value.split('/').filter(Boolean)
  parts.forEach((part, index) => {
    crumbs.push({
      name: part,
      path: parts.slice(0, index + 1).join('/')
    })
  })
  return crumbs
})

const filteredComics = computed(() => {
  const query = comicQuery.value.trim().toLowerCase()
  if (!query) return comics.value
  return comics.value.filter((comic) => {
    return comic.title.toLowerCase().includes(query)
  })
})

const allFilteredSelected = computed(() => {
  return filteredComics.value.length > 0
    && filteredComics.value.every((comic) => selectedComicIds.value.includes(comic.id))
})

const canPreviewPrevious = computed(() => previewIndex.value > 0)
const canPreviewNext = computed(() => previewIndex.value >= 0 && previewIndex.value < previewList.value.length - 1)
const previewPositionLabel = computed(() => {
  if (!previewImage.value || !previewList.value.length || previewIndex.value < 0) return ''
  return `${previewIndex.value + 1} / ${previewList.value.length}`
})

const loadSettings = async () => {
  const settings = await fetchSettings().catch(() => ({}))
  libraryPathDraft.value = settings.libraryPath || ''
}

const openFolder = async (path = '') => {
  folderLoading.value = true
  try {
    const data = await fetchFolder(path)
    currentPath.value = data.currentPath || ''
    folder.libraryPath = data.libraryPath || ''
    folder.folders = data.folders || []
    folder.images = data.images || []
  } catch (e) {
    message.value = e.message || '目录加载失败'
  } finally {
    folderLoading.value = false
  }
}

const loadComics = async () => {
  const comicData = await fetchComics().catch(() => [])
  comics.value = comicData
  const availableIds = new Set(comicData.map((comic) => comic.id))
  selectedComicIds.value = selectedComicIds.value.filter((id) => availableIds.has(id))
}

const loadCategories = async () => {
  categories.value = await fetchCategories().catch(() => [])
}

const loadAll = async () => {
  await Promise.all([loadSettings(), openFolder(currentPath.value), loadComics(), loadCategories()])
}

const saveLibraryPath = async () => {
  await updateSetting('libraryPath', libraryPathDraft.value)
  message.value = '漫画库根目录已保存'
  await openFolder('')
}

const scan = async () => {
  scanning.value = true
  message.value = ''
  try {
    const result = await scanLibrary(libraryPathDraft.value)
    message.value = `扫描完成：${result.comicCount} 本，${result.chapterCount} 章，${result.pageCount} 页`
    await loadAll()
  } catch (e) {
    message.value = e.message || '扫描失败'
  } finally {
    scanning.value = false
  }
}

const renamePath = async (path, newName) => {
  const cleanName = String(newName || '').trim()
  if (!cleanName) return
  await renameFile(path, cleanName)
  message.value = '已重命名，建议重新扫描索引'
  await openFolder(currentPath.value)
}

const startDragFolder = (dir) => {
  draggedFolder.value = dir
}

const dropFolder = async (targetDir) => {
  if (!draggedFolder.value || draggedFolder.value.path === targetDir.path) return
  if (!confirm(`将目录“${draggedFolder.value.name}”移动到“${targetDir.name}”下？`)) return
  try {
    await moveFolder(draggedFolder.value.path, targetDir.path)
    message.value = '目录已移动，建议重新扫描索引'
    await openFolder(currentPath.value)
  } finally {
    draggedFolder.value = null
  }
}

const clearDeleteConfirmTimer = () => {
  if (!deleteConfirmDialog.timerId) return
  window.clearInterval(deleteConfirmDialog.timerId)
  deleteConfirmDialog.timerId = null
}

const closeDeleteConfirmDialog = () => {
  if (deleteConfirmDialog.submitting) return
  clearDeleteConfirmTimer()
  deleteConfirmDialog.open = false
  deleteConfirmDialog.path = ''
  deleteConfirmDialog.name = ''
  deleteConfirmDialog.type = 'file'
  deleteConfirmDialog.secondsRemaining = 0
}

const removePath = (path, name, type = 'file') => {
  clearDeleteConfirmTimer()
  deleteConfirmDialog.open = true
  deleteConfirmDialog.path = path
  deleteConfirmDialog.name = name
  deleteConfirmDialog.type = type
  deleteConfirmDialog.secondsRemaining = 3
  deleteConfirmDialog.submitting = false
  deleteConfirmDialog.timerId = window.setInterval(() => {
    deleteConfirmDialog.secondsRemaining = Math.max(0, deleteConfirmDialog.secondsRemaining - 1)
    if (deleteConfirmDialog.secondsRemaining === 0) clearDeleteConfirmTimer()
  }, 1000)
}

const confirmDeletePath = async () => {
  if (!deleteConfirmDialog.open || deleteConfirmDialog.secondsRemaining > 0 || deleteConfirmDialog.submitting) return
  deleteConfirmDialog.submitting = true
  const deletedType = deleteConfirmDialog.type
  const deletedName = deleteConfirmDialog.name
  const deletedPath = deleteConfirmDialog.path
  try {
    await deleteFile(deletedPath)
    message.value = `已删除${deletedType === 'folder' ? '文件夹' : '文件'}“${deletedName}”，建议重新扫描索引`
    deleteConfirmDialog.submitting = false
    closeDeleteConfirmDialog()
    if (normalizedPath(previewImage.value?.path) === normalizedPath(deletedPath)) closePreview()
    await openFolder(currentPath.value)
  } catch (e) {
    deleteConfirmDialog.submitting = false
    message.value = e.message || '删除失败'
  }
}

const setCover = async (image) => {
  await setFolderCover(currentPath.value, image.path)
  message.value = '当前目录封面已设置'
  await openFolder(currentPath.value)
}

const normalizedPath = (value) => String(value || '').replace(/\\/g, '/')

const parentDirectoryPath = (filePath) => {
  const normalized = normalizedPath(filePath)
  const separatorIndex = normalized.lastIndexOf('/')
  return separatorIndex > 0 ? normalized.slice(0, separatorIndex) : ''
}

const canSetParentFolderCover = (item, isFolder) => {
  return isFolder && !!currentPath.value && !!item.coverImage
}

const setParentFolderCover = async (folderItem) => {
  await setFolderCover(currentPath.value, folderItem.coverImage)
  message.value = '上级目录封面已设置'
  await openFolder(currentPath.value)
}

const openPreview = (image, list = []) => {
  const normalizedImagePath = normalizedPath(image?.path)
  const normalizedList = list.map((item) => ({
    path: item.path || item.filePath,
    name: item.name
  })).filter((item) => item.path)
  const foundIndex = normalizedList.findIndex((item) => normalizedPath(item.path) === normalizedImagePath)
  previewList.value = normalizedList.length ? normalizedList : [image]
  previewIndex.value = foundIndex >= 0 ? foundIndex : 0
  previewImage.value = previewList.value[previewIndex.value] || image
}

const closePreview = () => {
  previewImage.value = null
  previewList.value = []
  previewIndex.value = -1
}

const shiftPreview = (direction) => {
  if (!previewImage.value || !previewList.value.length) return
  const nextIndex = previewIndex.value + direction
  if (nextIndex < 0 || nextIndex >= previewList.value.length) return
  previewIndex.value = nextIndex
  previewImage.value = previewList.value[nextIndex]
}

const handlePreviewWheel = (event) => {
  if (!previewImage.value || Math.abs(event.deltaY) < 8) return
  const now = Date.now()
  if (now - lastPreviewWheelAt.value < 260) return
  lastPreviewWheelAt.value = now
  shiftPreview(event.deltaY > 0 ? 1 : -1)
}

const openFolderImagePreview = (image) => {
  openPreview(image, folder.images)
}

const closeContextMenu = () => {
  contextMenu.open = false
}

const showContextMenu = (event, title, items) => {
  const visibleItems = items.filter(Boolean)
  const estimatedHeight = 42 + visibleItems.length * 38
  contextMenu.title = title
  contextMenu.items = visibleItems
  contextMenu.x = Math.min(event.clientX, Math.max(12, window.innerWidth - 230))
  contextMenu.y = Math.min(event.clientY, Math.max(12, window.innerHeight - estimatedHeight - 12))
  contextMenu.open = true
}

const runContextAction = async (item) => {
  if (!item || item.disabled) return
  closeContextMenu()
  try {
    await item.action?.()
  } catch (e) {
    message.value = e.message || '操作失败'
  }
}

const openFileContextMenu = (event, item, type) => {
  const isFolder = type === 'folder'
  showContextMenu(event, item.name, [
    isFolder
      ? { label: '打开目录', action: () => openFolder(item.path) }
      : { label: '预览图片', action: () => openFolderImagePreview(item) },
    {
      label: '在资源管理器中显示',
      action: async () => {
        await revealFile(isFolder ? item.path : parentDirectoryPath(item.path))
        message.value = '已在资源管理器中显示'
      }
    },
    canSetParentFolderCover(item, isFolder) && { label: '设为上级目录封面', action: () => setParentFolderCover(item) },
    !isFolder && { label: '设为当前目录封面', action: () => setCover(item) },
    { label: isFolder ? '删除目录' : '删除图片', danger: true, action: () => removePath(item.path, item.name, isFolder ? 'folder' : 'file') }
  ])
}

const comicCategoryIds = (comic) => (comic.categories || []).map((category) => category.id)

const openCategoryDialog = (comic) => {
  categoryDialog.open = true
  categoryDialog.comic = comic
  categoryDialog.selectedIds = comicCategoryIds(comic)
}

const closeCategoryDialog = () => {
  categoryDialog.open = false
  categoryDialog.comic = null
  categoryDialog.selectedIds = []
}

const saveCategoryDialogSelection = async () => {
  if (!categoryDialog.comic) return
  const updated = await setComicCategories(categoryDialog.comic.id, categoryDialog.selectedIds)
  categoryDialog.comic.categories = updated.categories || []
  const comic = comics.value.find((item) => item.id === categoryDialog.comic.id)
  if (comic) comic.categories = updated.categories || []
  message.value = '漫画分类已更新'
}

const saveAndCloseCategoryDialog = async () => {
  await saveCategoryDialogSelection()
  closeCategoryDialog()
}

const toggleCategoryDialogSelection = (categoryId, checked) => {
  const ids = new Set(categoryDialog.selectedIds)
  if (checked) ids.add(categoryId)
  else ids.delete(categoryId)
  categoryDialog.selectedIds = [...ids]
}

const removeComicIndex = async (comic) => {
  if (!confirm(`只删除索引，不删除磁盘文件：${comic.title}？`)) return
  await deleteComicIndex(comic.id)
  comics.value = comics.value.filter((item) => item.id !== comic.id)
  selectedComicIds.value = selectedComicIds.value.filter((id) => id !== comic.id)
  message.value = '索引已删除'
}

const openComicContextMenu = (event, comic) => {
  showContextMenu(event, comic.title, [
    { label: '添加分类', action: () => openCategoryDialog(comic) },
    { label: '显示图片', action: () => openComicImages(comic, 'view') },
    { label: '设置封面', action: () => openComicImages(comic, 'cover') },
    { label: '删除索引', danger: true, action: () => removeComicIndex(comic) }
  ])
}

const toggleComicSelection = (comicId, checked) => {
  if (checked) {
    if (!selectedComicIds.value.includes(comicId)) selectedComicIds.value.push(comicId)
    return
  }
  selectedComicIds.value = selectedComicIds.value.filter((id) => id !== comicId)
}

const toggleAllFilteredComics = (checked) => {
  const ids = new Set(selectedComicIds.value)
  filteredComics.value.forEach((comic) => {
    if (checked) ids.add(comic.id)
    else ids.delete(comic.id)
  })
  selectedComicIds.value = [...ids]
}

const removeSelectedComicIndexes = async () => {
  const ids = [...selectedComicIds.value]
  if (!ids.length) return
  if (!confirm(`只删除 ${ids.length} 个漫画索引，不删除磁盘文件？`)) return
  await Promise.all(ids.map((id) => deleteComicIndex(id)))
  comics.value = comics.value.filter((comic) => !ids.includes(comic.id))
  selectedComicIds.value = []
  message.value = `已删除 ${ids.length} 个索引`
}

const chapterContainsPath = (chapter, filePath) => {
  const coverPath = normalizedPath(filePath)
  const chapterPath = normalizedPath(chapter?.path)
  if (!coverPath || !chapterPath) return false
  return coverPath === chapterPath
    || coverPath.startsWith(`${chapterPath}/`)
    || coverPath.startsWith(`${chapterPath}#`)
}

const openComicImages = async (comic, mode = 'view') => {
  comicImageDialog.open = true
  comicImageDialog.mode = mode
  comicImageDialog.comic = comic
  comicImageDialog.chapters = []
  comicImageDialog.activeChapterId = null
  comicImageDialog.pages = []
  comicImageDialog.pageLoading = true
  try {
    const detail = await fetchComic(comic.id)
    comicImageDialog.chapters = detail.chapters || []
    const coverChapter = mode === 'cover'
      ? comicImageDialog.chapters.find((chapter) => chapterContainsPath(chapter, comic.coverPath))
      : null
    const targetChapter = coverChapter || comicImageDialog.chapters[0]
    if (targetChapter) await selectDialogChapter(targetChapter)
    else comicImageDialog.pageLoading = false
  } catch (e) {
    message.value = e.message || '漫画图片加载失败'
    comicImageDialog.pageLoading = false
  }
}

const closeComicImageDialog = () => {
  comicImageDialog.open = false
  comicImageDialog.comic = null
  comicImageDialog.chapters = []
  comicImageDialog.activeChapterId = null
  comicImageDialog.pages = []
  comicImageDialog.pageLoading = false
}

const selectDialogChapter = async (chapter) => {
  comicImageDialog.activeChapterId = chapter.id
  comicImageDialog.pageLoading = true
  comicImageDialog.pages = []
  try {
    comicImageDialog.pages = await fetchChapterPages(chapter.id)
  } catch (e) {
    message.value = e.message || '章节图片加载失败'
  } finally {
    comicImageDialog.pageLoading = false
  }
}

const chooseCoverPage = async (page) => {
  if (!comicImageDialog.comic) return
  const updated = await setComicCover(comicImageDialog.comic.id, page.filePath)
  const comic = comics.value.find((item) => item.id === updated.id)
  if (comic) comic.coverPath = updated.coverPath
  comicImageDialog.comic.coverPath = updated.coverPath
  message.value = '漫画封面已更新'
}

const previewPage = (page) => {
  openPreview(
    { path: page.filePath, name: page.name },
    comicImageDialog.pages.map((item) => ({ path: item.filePath, name: item.name }))
  )
}

const isCurrentComicCover = (page) => {
  return normalizedPath(page?.filePath) === normalizedPath(comicImageDialog.comic?.coverPath)
}

const openDialogPageContextMenu = (event, page) => {
  showContextMenu(event, page.name, [
    { label: '预览图片', action: () => previewPage(page) },
    { label: isCurrentComicCover(page) ? '已是当前封面' : '设为漫画封面', disabled: isCurrentComicCover(page), action: () => chooseCoverPage(page) }
  ])
}

const persistCategoryOrder = async () => {
  await Promise.all(categories.value.map((category, index) => (
    updateCategory(category.id, { sortOrder: index })
  )))
  categories.value = categories.value.map((category, index) => ({ ...category, sortOrder: index }))
  message.value = '分类排序已保存'
}

const moveCategory = async (index, direction) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= categories.value.length) return
  const nextCategories = [...categories.value]
  const [category] = nextCategories.splice(index, 1)
  nextCategories.splice(targetIndex, 0, category)
  categories.value = nextCategories
  try {
    await persistCategoryOrder()
  } catch (e) {
    categories.value = await fetchCategories().catch(() => categories.value)
    message.value = e.message || '分类排序保存失败'
  }
}

const openCategoryListContextMenu = (event) => {
  if (activeTab.value !== 'categories') return
  showContextMenu(event, '分类管理', [
    { label: '新增分类', action: () => openCreateCategoryDialog() }
  ])
}

const openCategoryContextMenu = (event, category, index) => {
  showContextMenu(event, category.name, [
    { label: '新增分类', action: () => openCreateCategoryDialog() },
    { label: '上移', disabled: index === 0, action: () => moveCategory(index, -1) },
    { label: '下移', disabled: index === categories.value.length - 1, action: () => moveCategory(index, 1) },
    { label: '删除分类', danger: true, action: () => removeCategory(category) }
  ])
}

const categoryNameExists = (name) => {
  const normalizedName = String(name || '').trim().toLowerCase()
  return categories.value.some((category) => category.name.trim().toLowerCase() === normalizedName)
}

const openCreateCategoryDialog = ({ attachToCurrentComic = false } = {}) => {
  createCategoryDialog.open = true
  createCategoryDialog.name = ''
  createCategoryDialog.sortOrder = categories.value.length
  createCategoryDialog.error = ''
  createCategoryDialog.attachToCurrentComic = attachToCurrentComic
}

const closeCreateCategoryDialog = () => {
  createCategoryDialog.open = false
  createCategoryDialog.name = ''
  createCategoryDialog.sortOrder = 0
  createCategoryDialog.error = ''
  createCategoryDialog.attachToCurrentComic = false
}

const saveCreateCategoryDialog = async () => {
  const name = createCategoryDialog.name.trim()
  if (!name) {
    createCategoryDialog.error = '请输入分类名'
    return
  }
  if (categoryNameExists(name)) {
    createCategoryDialog.error = '分类名已存在'
    return
  }
  const sortOrder = Number(createCategoryDialog.sortOrder)
  const category = await createCategory(name, Number.isFinite(sortOrder) ? sortOrder : categories.value.length)
  if (!categories.value.some((item) => item.id === category.id)) categories.value.push(category)
  categories.value = [...categories.value].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
    return left.name.localeCompare(right.name)
  })
  const attachToCurrentComic = createCategoryDialog.attachToCurrentComic
  closeCreateCategoryDialog()
  if (attachToCurrentComic && categoryDialog.open && !categoryDialog.selectedIds.includes(category.id)) {
    categoryDialog.selectedIds = [...categoryDialog.selectedIds, category.id]
  }
  message.value = '分类已创建'
}

const renameCategory = async (category, name) => {
  const cleanName = String(name || '').trim()
  if (!cleanName) return
  const updated = await updateCategory(category.id, { name: cleanName })
  category.name = updated.name
}

const removeCategory = async (category) => {
  if (!confirm(`删除分类“${category.name}”？`)) return
  await deleteCategory(category.id)
  categories.value = categories.value.filter((item) => item.id !== category.id)
  comics.value.forEach((comic) => {
    comic.categories = (comic.categories || []).filter((item) => item.id !== category.id)
  })
}

const handleGlobalKeydown = (event) => {
  if (previewImage.value && event.key === 'ArrowLeft') {
    event.preventDefault()
    shiftPreview(-1)
  }
  if (previewImage.value && event.key === 'ArrowRight') {
    event.preventDefault()
    shiftPreview(1)
  }
  if (event.key === 'Escape' && previewImage.value) closePreview()
  if (event.key === 'Escape' && deleteConfirmDialog.open) closeDeleteConfirmDialog()
  if (event.key === 'Escape') closeContextMenu()
}

onMounted(() => {
  loadAll()
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('scroll', closeContextMenu, true)
})

onBeforeUnmount(() => {
  clearDeleteConfirmTimer()
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)
})
</script>
