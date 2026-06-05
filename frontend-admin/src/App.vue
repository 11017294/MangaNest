<template>
  <main class="admin-shell" @click="closeContextMenu">
    <AdminSidebar
      :current-path="currentPath"
      :folder="folder"
      :breadcrumbs="breadcrumbs"
      @open-folder="openFolder"
    />

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

      <nav class="admin-menu-bar" aria-label="管理菜单">
        <button :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">文件</button>
        <button :class="{ active: activeTab === 'comics' }" @click="activeTab = 'comics'">漫画</button>
        <button :class="{ active: activeTab === 'categories' }" @click="activeTab = 'categories'">分类</button>
        <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">设置</button>
      </nav>

      <FileManagerPanel
        v-if="activeTab === 'files'"
        :folder="folder"
        :folder-loading="folderLoading"
        @context="openFileContextMenu"
        @drag-start="startDragFolder"
        @drop-folder="dropFolder"
        @open-folder="openFolder"
        @preview-image="openFolderImagePreview"
        @rename="renamePath"
      />

      <ComicManagerPanel
        v-if="activeTab === 'comics'"
        v-model:query="comicQuery"
        :comics="filteredComics"
        :selected-comic-ids="selectedComicIds"
        :all-selected="allFilteredSelected"
        @context="openComicContextMenu"
        @open-category-dialog="openCategoryDialog"
        @open-images="openComicImages"
        @remove-index="removeComicIndex"
        @remove-selected="removeSelectedComicIndexes"
        @toggle-all="toggleAllFilteredComics"
        @toggle-selection="toggleComicSelection"
      />

      <CategoryManagerPanel
        v-if="activeTab === 'categories'"
        :categories="categories"
        @category-context="openCategoryContextMenu"
        @create="openCreateCategoryDialog"
        @list-context="openCategoryListContextMenu"
        @move="moveCategory"
        @remove="removeCategory"
        @rename="renameCategory"
      />

      <SettingsPanel
        v-if="activeTab === 'settings'"
        v-model:library-path-draft="libraryPathDraft"
        :library-path="folder.libraryPath"
        :scanning="scanning"
        @save="saveLibraryPath"
        @scan="scan"
      />
    </section>

    <ImagePreview
      :image="previewImage"
      :can-previous="canPreviewPrevious"
      :can-next="canPreviewNext"
      :position-label="previewPositionLabel"
      @close="closePreview"
      @shift="shiftPreview"
      @wheel="handlePreviewWheel"
    />

    <DeleteConfirmDialog
      :dialog="deleteConfirmDialog"
      @close="closeDeleteConfirmDialog"
      @confirm="confirmDeletePath"
    />

    <ComicImageDialog
      :dialog="comicImageDialog"
      :is-current-cover="isCurrentComicCover"
      @choose-cover="chooseCoverPage"
      @close="closeComicImageDialog"
      @page-context="openDialogPageContextMenu"
      @preview-page="previewPage"
      @select-chapter="selectDialogChapter"
    />

    <CategoryDialog
      :dialog="categoryDialog"
      :categories="categories"
      @close="closeCategoryDialog"
      @create="openCreateCategoryDialog({ attachToCurrentComic: true })"
      @save="saveAndCloseCategoryDialog"
      @toggle="toggleCategoryDialogSelection"
    />

    <CreateCategoryDialog
      :dialog="createCategoryDialog"
      @close="closeCreateCategoryDialog"
      @save="saveCreateCategoryDialog"
      @update:name="createCategoryDialog.name = $event"
      @update:sort-order="createCategoryDialog.sortOrder = $event"
    />

    <ContextMenu :menu="contextMenu" @run="runContextAction" />
    <AdminMessage :messages="messages" @close="removeMessage" />
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AdminMessage from './components/AdminMessage.vue'
import AdminSidebar from './components/AdminSidebar.vue'
import CategoryDialog from './components/CategoryDialog.vue'
import CategoryManagerPanel from './components/CategoryManagerPanel.vue'
import ComicImageDialog from './components/ComicImageDialog.vue'
import ComicManagerPanel from './components/ComicManagerPanel.vue'
import ContextMenu from './components/ContextMenu.vue'
import CreateCategoryDialog from './components/CreateCategoryDialog.vue'
import DeleteConfirmDialog from './components/DeleteConfirmDialog.vue'
import FileManagerPanel from './components/FileManagerPanel.vue'
import ImagePreview from './components/ImagePreview.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import { useContextMenu } from './composables/useContextMenu'
import { useDeleteConfirm } from './composables/useDeleteConfirm'
import { useImagePreview } from './composables/useImagePreview'
import { useMessages } from './composables/useMessages'
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
const scanning = ref(false)
const folderLoading = ref(false)
const draggedFolder = ref(null)
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
const folder = reactive({
  libraryPath: '',
  folders: [],
  images: []
})
const { messages, notifyError, notifySuccess, removeMessage } = useMessages()
const { closeContextMenu, contextMenu, runContextAction, showContextMenu } = useContextMenu({ onError: notifyError })
const { closeDeleteConfirmDialog, deleteConfirmDialog, openDeleteConfirmDialog } = useDeleteConfirm()
const {
  canPreviewNext,
  canPreviewPrevious,
  closePreview,
  handlePreviewWheel,
  openPreview,
  previewImage,
  previewPositionLabel,
  shiftPreview
} = useImagePreview()

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
    notifyError(e.message || '目录加载失败')
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
  try {
    await updateSetting('libraryPath', libraryPathDraft.value)
    notifySuccess('漫画库根目录已保存')
    await openFolder('')
  } catch (e) {
    notifyError(e.message || '漫画库根目录保存失败')
  }
}

const scan = async () => {
  scanning.value = true
  try {
    const result = await scanLibrary(libraryPathDraft.value)
    notifySuccess(`扫描完成：${result.comicCount} 本，${result.chapterCount} 章，${result.pageCount} 页`)
    await loadAll()
  } catch (e) {
    notifyError(e.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

const renamePath = async (path, newName) => {
  const cleanName = String(newName || '').trim()
  if (!cleanName) return
  try {
    await renameFile(path, cleanName)
    notifySuccess('已重命名，建议重新扫描索引')
    await openFolder(currentPath.value)
  } catch (e) {
    notifyError(e.message || '重命名失败')
  }
}

const startDragFolder = (dir) => {
  draggedFolder.value = dir
}

const dropFolder = async (targetDir) => {
  if (!draggedFolder.value || draggedFolder.value.path === targetDir.path) return
  if (!confirm(`将目录“${draggedFolder.value.name}”移动到“${targetDir.name}”下？`)) return
  try {
    await moveFolder(draggedFolder.value.path, targetDir.path)
    notifySuccess('目录已移动，建议重新扫描索引')
    await openFolder(currentPath.value)
  } catch (e) {
    notifyError(e.message || '目录移动失败')
  } finally {
    draggedFolder.value = null
  }
}

const removePath = (path, name, type = 'file') => {
  openDeleteConfirmDialog(path, name, type)
}

const confirmDeletePath = async () => {
  if (!deleteConfirmDialog.open || deleteConfirmDialog.secondsRemaining > 0 || deleteConfirmDialog.submitting) return
  deleteConfirmDialog.submitting = true
  const deletedType = deleteConfirmDialog.type
  const deletedName = deleteConfirmDialog.name
  const deletedPath = deleteConfirmDialog.path
  try {
    await deleteFile(deletedPath)
    notifySuccess(`已删除${deletedType === 'folder' ? '文件夹' : '文件'}“${deletedName}”，建议重新扫描索引`)
    deleteConfirmDialog.submitting = false
    closeDeleteConfirmDialog()
    if (normalizedPath(previewImage.value?.path) === normalizedPath(deletedPath)) closePreview()
    await openFolder(currentPath.value)
  } catch (e) {
    deleteConfirmDialog.submitting = false
    notifyError(e.message || '删除失败')
  }
}

const setCover = async (image) => {
  try {
    await setFolderCover(currentPath.value, image.path)
    notifySuccess('当前目录封面已设置')
    await openFolder(currentPath.value)
  } catch (e) {
    notifyError(e.message || '封面设置失败')
  }
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
  try {
    await setFolderCover(currentPath.value, folderItem.coverImage)
    notifySuccess('上级目录封面已设置')
    await openFolder(currentPath.value)
  } catch (e) {
    notifyError(e.message || '上级目录封面设置失败')
  }
}

const openFolderImagePreview = (image) => {
  openPreview(image, folder.images)
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
        notifySuccess('已在资源管理器中显示')
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
  if (!categoryDialog.comic) return false
  try {
    const updated = await setComicCategories(categoryDialog.comic.id, categoryDialog.selectedIds)
    categoryDialog.comic.categories = updated.categories || []
    const comic = comics.value.find((item) => item.id === categoryDialog.comic.id)
    if (comic) comic.categories = updated.categories || []
    notifySuccess('漫画分类已更新')
    return true
  } catch (e) {
    notifyError(e.message || '漫画分类更新失败')
    return false
  }
}

const saveAndCloseCategoryDialog = async () => {
  const saved = await saveCategoryDialogSelection()
  if (saved) closeCategoryDialog()
}

const toggleCategoryDialogSelection = (categoryId, checked) => {
  const ids = new Set(categoryDialog.selectedIds)
  if (checked) ids.add(categoryId)
  else ids.delete(categoryId)
  categoryDialog.selectedIds = [...ids]
}

const removeComicIndex = async (comic) => {
  if (!confirm(`只删除索引，不删除磁盘文件：${comic.title}？`)) return
  try {
    await deleteComicIndex(comic.id)
    comics.value = comics.value.filter((item) => item.id !== comic.id)
    selectedComicIds.value = selectedComicIds.value.filter((id) => id !== comic.id)
    notifySuccess('索引已删除')
  } catch (e) {
    notifyError(e.message || '索引删除失败')
  }
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
  try {
    await Promise.all(ids.map((id) => deleteComicIndex(id)))
    comics.value = comics.value.filter((comic) => !ids.includes(comic.id))
    selectedComicIds.value = []
    notifySuccess(`已删除 ${ids.length} 个索引`)
  } catch (e) {
    notifyError(e.message || '批量删除索引失败')
  }
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
    notifyError(e.message || '漫画图片加载失败')
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
    notifyError(e.message || '章节图片加载失败')
  } finally {
    comicImageDialog.pageLoading = false
  }
}

const chooseCoverPage = async (page) => {
  if (!comicImageDialog.comic) return
  try {
    const updated = await setComicCover(comicImageDialog.comic.id, page.filePath)
    const comic = comics.value.find((item) => item.id === updated.id)
    if (comic) comic.coverPath = updated.coverPath
    comicImageDialog.comic.coverPath = updated.coverPath
    notifySuccess('漫画封面已更新')
  } catch (e) {
    notifyError(e.message || '漫画封面更新失败')
  }
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
  notifySuccess('分类排序已保存')
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
    notifyError(e.message || '分类排序保存失败')
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
  try {
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
    notifySuccess('分类已创建')
  } catch (e) {
    notifyError(e.message || '分类创建失败')
  }
}

const renameCategory = async (category, name) => {
  const cleanName = String(name || '').trim()
  if (!cleanName) return
  try {
    const updated = await updateCategory(category.id, { name: cleanName })
    category.name = updated.name
    notifySuccess('分类已重命名')
  } catch (e) {
    notifyError(e.message || '分类重命名失败')
  }
}

const removeCategory = async (category) => {
  if (!confirm(`删除分类“${category.name}”？`)) return
  try {
    await deleteCategory(category.id)
    categories.value = categories.value.filter((item) => item.id !== category.id)
    comics.value.forEach((comic) => {
      comic.categories = (comic.categories || []).filter((item) => item.id !== category.id)
    })
    notifySuccess('分类已删除')
  } catch (e) {
    notifyError(e.message || '分类删除失败')
  }
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
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)
})
</script>
