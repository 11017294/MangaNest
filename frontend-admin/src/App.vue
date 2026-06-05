<template>
  <main class="admin-shell">
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
      <section class="library-console">
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
          <p v-if="message" class="message">{{ message }}</p>
        </div>
      </section>

      <header class="workspace-header">
        <div>
          <span class="eyebrow">File Manager</span>
          <h1>{{ currentPath || '漫画库根目录' }}</h1>
        </div>
        <div class="header-actions">
          <button class="secondary-button" @click="loadAll">刷新</button>
        </div>
      </header>

      <nav class="admin-menu-bar" aria-label="管理菜单">
        <button :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">文件</button>
        <button :class="{ active: activeTab === 'comics' }" @click="activeTab = 'comics'">漫画</button>
        <button :class="{ active: activeTab === 'categories' }" @click="activeTab = 'categories'">分类</button>
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
            @dragstart="startDragFolder(dir)"
            @dragover.prevent
            @drop.prevent="dropFolder(dir)"
          >
            <button class="thumb folder-thumb" @click="openFolder(dir.path)">
              <img v-if="dir.coverImage" :src="imageUrl(dir.coverImage)" alt="" loading="lazy" />
              <span v-else>DIR</span>
            </button>
            <input
              :value="dir.name"
              class="name-input"
              @change="renamePath(dir.path, $event.target.value)"
            />
            <div class="row-actions">
              <button @click="openFolder(dir.path)">打开</button>
              <button class="danger-text" @click="removePath(dir.path, dir.name)">删除</button>
            </div>
          </article>

          <article v-for="image in folder.images" :key="image.path" class="image-card">
            <button class="thumb" @click="previewImage = image">
              <img :src="imageUrl(image.path)" :alt="image.name" loading="lazy" />
            </button>
            <input
              :value="image.name"
              class="name-input"
              @change="renamePath(image.path, $event.target.value)"
            />
            <div class="row-actions">
              <button @click="setCover(image)">设封面</button>
              <button class="danger-text" @click="removePath(image.path, image.name)">删除</button>
            </div>
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
          <article v-for="comic in filteredComics" :key="comic.id" class="comic-row">
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
              <div class="category-checks">
                <label v-for="category in categories" :key="category.id">
                  <input
                    type="checkbox"
                    :checked="comicCategoryIds(comic).includes(category.id)"
                    @change="toggleComicCategory(comic, category.id, $event.target.checked)"
                  />
                  {{ category.name }}
                </label>
              </div>
            </div>
            <div class="comic-actions">
              <button @click="openComicImages(comic, 'view')">显示图片</button>
              <button @click="openComicImages(comic, 'cover')">设置封面</button>
              <button class="danger-button" @click="removeComicIndex(comic)">删索引</button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="activeTab === 'categories'" class="panel content-panel">
        <div class="panel-title">
          <h2>分类管理</h2>
          <span>{{ categories.length }} 个</span>
        </div>
        <form class="category-form" @submit.prevent="addCategory">
          <input v-model="newCategoryName" placeholder="新分类名称" />
          <button class="primary-button" type="submit">新增分类</button>
        </form>
        <div class="category-list">
          <article v-for="category in categories" :key="category.id" class="category-row">
            <input :value="category.name" @change="renameCategory(category, $event.target.value)" />
            <button class="danger-text" @click="removeCategory(category)">删除</button>
          </article>
        </div>
      </section>
    </section>

    <div v-if="previewImage" class="preview-overlay" @click.self="previewImage = null">
      <button class="preview-close" @click="previewImage = null">关闭</button>
      <img :src="imageUrl(previewImage.path)" :alt="previewImage.name" />
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
                @click="comicImageDialog.mode === 'cover' ? chooseCoverPage(page) : previewPage(page)"
              >
                <img :src="imageUrl(page.filePath)" :alt="page.name" loading="lazy" />
                <span>{{ page.name }}</span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
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
const comicQuery = ref('')
const newCategoryName = ref('')
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

const removePath = async (path, name) => {
  if (!confirm(`确定删除“${name}”？这个操作会删除磁盘文件。`)) return
  await deleteFile(path)
  message.value = '已删除，建议重新扫描索引'
  await openFolder(currentPath.value)
}

const setCover = async (image) => {
  await setFolderCover(currentPath.value, image.path)
  message.value = '当前目录封面已设置'
  await openFolder(currentPath.value)
}

const comicCategoryIds = (comic) => (comic.categories || []).map((category) => category.id)

const toggleComicCategory = async (comic, categoryId, checked) => {
  const ids = new Set(comicCategoryIds(comic))
  if (checked) ids.add(categoryId)
  else ids.delete(categoryId)
  const updated = await setComicCategories(comic.id, [...ids])
  comic.categories = updated.categories || []
}

const removeComicIndex = async (comic) => {
  if (!confirm(`只删除索引，不删除磁盘文件：${comic.title}？`)) return
  await deleteComicIndex(comic.id)
  comics.value = comics.value.filter((item) => item.id !== comic.id)
  selectedComicIds.value = selectedComicIds.value.filter((id) => id !== comic.id)
  message.value = '索引已删除'
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
    const firstChapter = comicImageDialog.chapters[0]
    if (firstChapter) await selectDialogChapter(firstChapter)
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
  previewImage.value = { path: page.filePath, name: page.name }
}

const addCategory = async () => {
  const name = newCategoryName.value.trim()
  if (!name) return
  const category = await createCategory(name)
  if (!categories.value.some((item) => item.id === category.id)) categories.value.push(category)
  newCategoryName.value = ''
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

onMounted(loadAll)
</script>
