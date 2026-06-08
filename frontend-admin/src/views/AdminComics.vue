<template>
  <section class="workspace" @click="closeContextMenu">
    <ComicManagerPanel
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

    <ImagePreview
      :image="previewImage"
      :can-previous="canPreviewPrevious"
      :can-next="canPreviewNext"
      :position-label="previewPositionLabel"
      @close="closePreview"
      @shift="shiftPreview"
      @wheel="handlePreviewWheel"
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

    <ConfirmDialog
      :dialog="confirmDialog"
      @cancel="cancelConfirmDialog"
      @confirm="acceptConfirmDialog"
    />

    <ContextMenu :menu="contextMenu" @run="runContextAction" />
    <AdminMessage :messages="messages" @close="removeMessage" />
  </section>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref } from 'vue'
import CategoryDialog from '../components/categories/CategoryDialog.vue'
import CreateCategoryDialog from '../components/categories/CreateCategoryDialog.vue'
import ComicImageDialog from '../components/comics/ComicImageDialog.vue'
import ComicManagerPanel from '../components/comics/ComicManagerPanel.vue'
import AdminMessage from '../components/common/AdminMessage.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import ImagePreview from '../components/common/ImagePreview.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useContextMenu } from '../composables/useContextMenu'
import { useImagePreview } from '../composables/useImagePreview'
import { useMessages } from '../composables/useMessages'
import {
  createCategory,
  deleteComicIndex,
  fetchCategories,
  fetchChapterPages,
  fetchComic,
  fetchComics,
  setComicCategories,
  setComicCover
} from '../services/api'

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

const { messages, notifyError, notifySuccess, removeMessage } = useMessages()
const { acceptConfirmDialog, cancelConfirmDialog, confirm, confirmDialog } = useConfirmDialog()
const { closeContextMenu, contextMenu, runContextAction, showContextMenu } = useContextMenu({ onError: notifyError })
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

const filteredComics = computed(() => {
  const query = comicQuery.value.trim().toLowerCase()
  if (!query) return comics.value
  return comics.value.filter((comic) => comic.title.toLowerCase().includes(query))
})

const allFilteredSelected = computed(() => {
  return filteredComics.value.length > 0
    && filteredComics.value.every((comic) => selectedComicIds.value.includes(comic.id))
})

const normalizedPath = (value) => String(value || '').replace(/\\/g, '/')

const loadComics = async () => {
  const comicData = await fetchComics().catch(() => [])
  comics.value = comicData
  const availableIds = new Set(comicData.map((comic) => comic.id))
  selectedComicIds.value = selectedComicIds.value.filter((id) => availableIds.has(id))
}

const loadCategories = async () => {
  categories.value = await fetchCategories().catch(() => [])
}

const loadComicsPage = async () => {
  await Promise.all([loadComics(), loadCategories()])
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
  const confirmed = await confirm({
    title: '删除索引',
    message: `只删除索引，不删除磁盘文件：${comic.title}？`,
    detail: '磁盘上的漫画文件会保留，重新扫描后可能再次生成索引。',
    confirmText: '删除索引',
    danger: true
  })
  if (!confirmed) return
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
  const confirmed = await confirm({
    title: '批量删除索引',
    message: `只删除 ${ids.length} 个漫画索引，不删除磁盘文件？`,
    detail: '磁盘上的漫画文件会保留，重新扫描后可能再次生成索引。',
    confirmText: '批量删除',
    danger: true
  })
  if (!confirmed) return
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
  if (event.key === 'Escape' && confirmDialog.open) cancelConfirmDialog()
  if (event.key === 'Escape') closeContextMenu()
}

const addGlobalListeners = () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', closeContextMenu)
  window.addEventListener('scroll', closeContextMenu, true)
}

const removeGlobalListeners = () => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', closeContextMenu)
  window.removeEventListener('scroll', closeContextMenu, true)
}

let hasActivated = false
const activateView = () => {
  addGlobalListeners()
  if (hasActivated) loadComicsPage()
  hasActivated = true
}

const deactivateView = () => {
  removeGlobalListeners()
  closeContextMenu()
}

onMounted(() => {
  loadComicsPage()
})

onActivated(activateView)
onDeactivated(deactivateView)
onBeforeUnmount(removeGlobalListeners)
</script>
