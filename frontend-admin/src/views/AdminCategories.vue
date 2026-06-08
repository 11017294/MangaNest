<template>
  <section class="workspace" @click="closeContextMenu">
    <CategoryManagerPanel
      :categories="categories"
      @category-context="openCategoryContextMenu"
      @create="openCreateCategoryDialog"
      @list-context="openCategoryListContextMenu"
      @move="moveCategory"
      @remove="removeCategory"
      @rename="renameCategory"
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
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref } from 'vue'
import CategoryManagerPanel from '../components/categories/CategoryManagerPanel.vue'
import CreateCategoryDialog from '../components/categories/CreateCategoryDialog.vue'
import AdminMessage from '../components/common/AdminMessage.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useContextMenu } from '../composables/useContextMenu'
import { useMessages } from '../composables/useMessages'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory
} from '../services/api'

const categories = ref([])
const createCategoryDialog = reactive({
  open: false,
  name: '',
  sortOrder: 0,
  error: ''
})

const { messages, notifyError, notifySuccess, removeMessage } = useMessages()
const { acceptConfirmDialog, cancelConfirmDialog, confirm, confirmDialog } = useConfirmDialog()
const { closeContextMenu, contextMenu, runContextAction, showContextMenu } = useContextMenu({ onError: notifyError })

const loadCategories = async () => {
  categories.value = await fetchCategories().catch(() => [])
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

const openCreateCategoryDialog = () => {
  createCategoryDialog.open = true
  createCategoryDialog.name = ''
  createCategoryDialog.sortOrder = categories.value.length
  createCategoryDialog.error = ''
}

const closeCreateCategoryDialog = () => {
  createCategoryDialog.open = false
  createCategoryDialog.name = ''
  createCategoryDialog.sortOrder = 0
  createCategoryDialog.error = ''
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
    closeCreateCategoryDialog()
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
  const confirmed = await confirm({
    title: '删除分类',
    message: `删除分类“${category.name}”？`,
    detail: '只会删除分类关系，不会删除漫画或磁盘文件。',
    confirmText: '删除分类',
    danger: true
  })
  if (!confirmed) return
  try {
    await deleteCategory(category.id)
    categories.value = categories.value.filter((item) => item.id !== category.id)
    notifySuccess('分类已删除')
  } catch (e) {
    notifyError(e.message || '分类删除失败')
  }
}

const handleGlobalKeydown = (event) => {
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
  if (hasActivated) loadCategories()
  hasActivated = true
}

const deactivateView = () => {
  removeGlobalListeners()
  closeContextMenu()
}

onMounted(() => {
  loadCategories()
})

onActivated(activateView)
onDeactivated(deactivateView)
onBeforeUnmount(removeGlobalListeners)
</script>
