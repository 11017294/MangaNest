<template>
  <section class="workspace" @click="closeContextMenu">
    <section class="files-workspace">
      <AdminSidebar :folder="folder" @open-folder="openFolder" />

      <FileManagerPanel
        :folder-loading="folderLoading"
        :breadcrumbs="breadcrumbs"
        :selected-paths="selectedFilePaths"
        :filter-text="fileFilterText"
        :hide-marked="hideMarkedFolders"
        :visible-folders="visibleFolders"
        :visible-images="visibleImages"
        @blank-context="openFileBlankContextMenu"
        @context="openFileContextMenu"
        @drag-start="startDragItem"
        @drop-target="dropPathTarget"
        @open-folder="openFolder"
        @preview-image="openFolderImagePreview"
        @rename="renamePath"
        @select-item="selectFileItem"
        @toggle-hide-marked="toggleHideMarkedFolders"
        @update:filter-text="fileFilterText = $event"
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

    <CreateFolderDialog
      :dialog="createFolderDialog"
      @close="closeCreateFolderDialog"
      @save="saveCreateFolderDialog"
      @update:name="createFolderDialog.name = $event"
    />

    <PrefixReplaceDialog
      :dialog="prefixReplaceDialog"
      @close="closePrefixReplaceDialog"
      @save="savePrefixReplaceDialog"
      @update:old-prefix="prefixReplaceDialog.oldPrefix = $event"
      @update:new-prefix="prefixReplaceDialog.newPrefix = $event"
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
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import AdminMessage from '../components/common/AdminMessage.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import ImagePreview from '../components/common/ImagePreview.vue'
import AdminSidebar from '../components/files/AdminSidebar.vue'
import CreateFolderDialog from '../components/files/CreateFolderDialog.vue'
import DeleteConfirmDialog from '../components/files/DeleteConfirmDialog.vue'
import FileManagerPanel from '../components/files/FileManagerPanel.vue'
import PrefixReplaceDialog from '../components/files/PrefixReplaceDialog.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useContextMenu } from '../composables/useContextMenu'
import { useImagePreview } from '../composables/useImagePreview'
import { useMessages } from '../composables/useMessages'
import {
  createFolder,
  deleteFile,
  fetchFolder,
  moveFile,
  moveFolder,
  renameFile,
  replaceFolderPrefixes,
  revealFile,
  setFolderCover,
  setFolderMarked
} from '../services/api'

const props = defineProps({
  openPathRequest: {
    type: Object,
    default: null
  }
})

const currentPath = ref('')
const folderLoading = ref(false)
const draggedItem = ref(null)
const selectedFilePaths = ref([])
const lastSelectedFilePath = ref('')
const fileFilterText = ref('')
const hideMarkedFolders = ref(false)
const folder = reactive({
  libraryPath: '',
  folders: [],
  images: []
})
const createFolderDialog = reactive({
  open: false,
  name: '',
  error: '',
  submitting: false
})
const prefixReplaceDialog = reactive({
  open: false,
  oldPrefix: '',
  newPrefix: '',
  error: '',
  submitting: false
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

const itemMatchesFileFilter = (item) => {
  const query = fileFilterText.value.trim().toLowerCase()
  if (!query) return true
  return item.name.toLowerCase().includes(query)
}

const visibleFolders = computed(() => folder.folders.filter(itemMatchesFileFilter))
const visibleImages = computed(() => folder.images.filter(itemMatchesFileFilter))
const fileItems = computed(() => [
  ...visibleFolders.value.map((item) => ({ ...item, type: 'folder' })),
  ...visibleImages.value.map((item) => ({ ...item, type: 'image' }))
])

const normalizedPath = (value) => String(value || '').replace(/\\/g, '/')

const parentDirectoryPath = (filePath) => {
  const normalized = normalizedPath(filePath)
  const separatorIndex = normalized.lastIndexOf('/')
  return separatorIndex > 0 ? normalized.slice(0, separatorIndex) : ''
}

const openFolder = async (path = '') => {
  folderLoading.value = true
  try {
    const data = await fetchFolder(path, { hideMarked: hideMarkedFolders.value })
    currentPath.value = data.currentPath || ''
    folder.libraryPath = data.libraryPath || ''
    folder.folders = data.folders || []
    folder.images = data.images || []
    const availablePaths = new Set([...folder.folders, ...folder.images].map((item) => item.path))
    selectedFilePaths.value = selectedFilePaths.value.filter((path) => availablePaths.has(path))
    if (!availablePaths.has(lastSelectedFilePath.value)) lastSelectedFilePath.value = ''
  } catch (e) {
    notifyError(e.message || '目录加载失败')
  } finally {
    folderLoading.value = false
  }
}

watch(
  () => props.openPathRequest,
  (request) => {
    if (!request) return
    openFolder(request.path || '')
  }
)

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

const toggleHideMarkedFolders = async (nextValue) => {
  hideMarkedFolders.value = nextValue
  selectedFilePaths.value = []
  lastSelectedFilePath.value = ''
  await openFolder(currentPath.value)
}

const openCreateFolderDialog = () => {
  createFolderDialog.open = true
  createFolderDialog.name = ''
  createFolderDialog.error = ''
  createFolderDialog.submitting = false
}

const closeCreateFolderDialog = () => {
  if (createFolderDialog.submitting) return
  createFolderDialog.open = false
  createFolderDialog.name = ''
  createFolderDialog.error = ''
}

const saveCreateFolderDialog = async () => {
  const name = createFolderDialog.name.trim()
  if (!name) {
    createFolderDialog.error = '请输入文件夹名称'
    return
  }
  createFolderDialog.submitting = true
  createFolderDialog.error = ''
  try {
    await createFolder(currentPath.value, name)
    notifySuccess('文件夹已创建')
    createFolderDialog.submitting = false
    closeCreateFolderDialog()
    await openFolder(currentPath.value)
  } catch (e) {
    createFolderDialog.submitting = false
    createFolderDialog.error = e.message || '文件夹创建失败'
  }
}

const openPrefixReplaceDialog = () => {
  prefixReplaceDialog.open = true
  prefixReplaceDialog.oldPrefix = ''
  prefixReplaceDialog.newPrefix = ''
  prefixReplaceDialog.error = ''
  prefixReplaceDialog.submitting = false
}

const closePrefixReplaceDialog = () => {
  if (prefixReplaceDialog.submitting) return
  prefixReplaceDialog.open = false
  prefixReplaceDialog.oldPrefix = ''
  prefixReplaceDialog.newPrefix = ''
  prefixReplaceDialog.error = ''
}

const savePrefixReplaceDialog = async () => {
  const oldPrefix = prefixReplaceDialog.oldPrefix
  const newPrefix = prefixReplaceDialog.newPrefix
  if (!oldPrefix && !newPrefix) {
    prefixReplaceDialog.error = '旧前缀为空时，需要填写新前缀'
    return
  }
  if (oldPrefix.includes('/') || oldPrefix.includes('\\') || newPrefix.includes('/') || newPrefix.includes('\\')) {
    prefixReplaceDialog.error = '前缀不能包含路径分隔符'
    return
  }
  prefixReplaceDialog.submitting = true
  prefixReplaceDialog.error = ''
  try {
    const result = await replaceFolderPrefixes(currentPath.value, oldPrefix, newPrefix)
    notifySuccess(`已处理 ${result.renamedCount || 0} 项：${result.folderCount || 0} 个目录，${result.fileCount || 0} 个文件`)
    prefixReplaceDialog.submitting = false
    closePrefixReplaceDialog()
    await openFolder(currentPath.value)
  } catch (e) {
    prefixReplaceDialog.submitting = false
    prefixReplaceDialog.error = e.message || '前缀处理失败'
  }
}

const selectFileItem = (event, item) => {
  const itemPath = item.path
  const currentItems = fileItems.value
  if (event.shiftKey && lastSelectedFilePath.value) {
    const startIndex = currentItems.findIndex((entry) => entry.path === lastSelectedFilePath.value)
    const endIndex = currentItems.findIndex((entry) => entry.path === itemPath)
    if (startIndex >= 0 && endIndex >= 0) {
      const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
      selectedFilePaths.value = currentItems.slice(from, to + 1).map((entry) => entry.path)
      return
    }
  }

  if (event.ctrlKey || event.metaKey) {
    selectedFilePaths.value = selectedFilePaths.value.includes(itemPath)
      ? selectedFilePaths.value.filter((path) => path !== itemPath)
      : [...selectedFilePaths.value, itemPath]
    lastSelectedFilePath.value = itemPath
    return
  }

  selectedFilePaths.value = [itemPath]
  lastSelectedFilePath.value = itemPath
}

const startDragItem = (item, type) => {
  draggedItem.value = { ...item, type }
  if (!selectedFilePaths.value.includes(item.path)) {
    selectedFilePaths.value = [item.path]
    lastSelectedFilePath.value = item.path
  }
}

const getSelectedDragItems = () => {
  if (!draggedItem.value) return []
  const selected = fileItems.value.filter((item) => selectedFilePaths.value.includes(item.path))
  return selected.length ? selected : [draggedItem.value]
}

const isPathInside = (path, parentPath) => {
  const normalized = normalizedPath(path)
  const parent = normalizedPath(parentPath)
  if (!parent) return !!normalized
  return normalized === parent || normalized.startsWith(`${parent}/`)
}

const dropPathTarget = async (targetDir) => {
  if (!draggedItem.value) return
  const itemsToMove = getSelectedDragItems()
  const movableItems = itemsToMove.filter((item) => item.path !== targetDir.path && !(item.type === 'folder' && isPathInside(targetDir.path, item.path)))
  if (!movableItems.length) {
    draggedItem.value = null
    return
  }
  const originalPath = currentPath.value
  const confirmed = await confirm({
    title: '移动文件',
    message: movableItems.length === 1
      ? `将“${movableItems[0].name}”移动到“${targetDir.name}”下？`
      : `将选中的 ${movableItems.length} 个项目移动到“${targetDir.name}”下？`,
    detail: '移动后会在后台同步漫画、章节和图片路径索引，同步期间相关目录不能再次移动。',
    confirmText: '确定移动'
  })
  if (!confirmed) {
    draggedItem.value = null
    return
  }
  try {
    for (const item of movableItems) {
      if (item.type === 'folder') await moveFolder(item.path, targetDir.path)
      else await moveFile(item.path, targetDir.path)
    }
    selectedFilePaths.value = []
    lastSelectedFilePath.value = ''
    notifySuccess(movableItems.length === 1
      ? `已移动到“${targetDir.name}”`
      : `已移动 ${movableItems.length} 个项目到“${targetDir.name}”`)
    await openFolder(originalPath)
  } catch (e) {
    notifyError(e.message || '移动失败')
    draggedItem.value = null
    return
  } finally {
    draggedItem.value = null
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

const openDeleteConfirmDialog = (path, name, type = 'file') => {
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

const updateFolderMarked = async (folderItem, marked) => {
  try {
    await setFolderMarked(folderItem.path, marked)
    notifySuccess(marked ? '已标记为整理完成' : '已取消整理标记')
    await openFolder(currentPath.value)
  } catch (e) {
    notifyError(e.message || '标记更新失败')
  }
}

const openFolderImagePreview = (image) => {
  openPreview(image, folder.images)
}

const openFileBlankContextMenu = (event) => {
  showContextMenu(event, '文件管理', [
    { label: '新增文件夹', action: () => openCreateFolderDialog() },
    { label: '批量处理前缀', action: () => openPrefixReplaceDialog() },
    {
      label: hideMarkedFolders.value ? '显示已整理目录' : '进入整理模式',
      action: () => toggleHideMarkedFolders(!hideMarkedFolders.value)
    }
  ])
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
    isFolder && {
      label: item.marked ? '取消整理标记' : '标记为已整理',
      action: () => updateFolderMarked(item, !item.marked)
    },
    canSetParentFolderCover(item, isFolder) && { label: '设为上级目录封面', action: () => setParentFolderCover(item) },
    !isFolder && { label: '设为当前目录封面', action: () => setCover(item) },
    { label: isFolder ? '删除目录' : '删除图片', danger: true, action: () => removePath(item.path, item.name, isFolder ? 'folder' : 'file') }
  ])
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
  if (hasActivated) openFolder(currentPath.value)
  hasActivated = true
}

const deactivateView = () => {
  removeGlobalListeners()
  closeContextMenu()
}

onMounted(() => {
  openFolder()
})

onActivated(activateView)
onDeactivated(deactivateView)
onBeforeUnmount(() => {
  removeGlobalListeners()
  clearDeleteConfirmTimer()
})
</script>
