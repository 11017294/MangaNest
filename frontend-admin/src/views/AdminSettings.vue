<template>
  <section class="workspace">
    <SettingsPanel
      v-model:library-path-draft="libraryPathDraft"
      :library-path="libraryPath"
      :scanning="scanning"
      :index-busy="indexBusy"
      :index-summary="indexSummary"
      :index-issue-count="indexIssueCount"
      @cleanup-index="cleanupIndex"
      @inspect-index="inspectIndex"
      @save="saveLibraryPath"
      @scan="scan"
    />

    <ConfirmDialog
      :dialog="confirmDialog"
      @cancel="cancelConfirmDialog"
      @confirm="acceptConfirmDialog"
    />
    <AdminMessage :messages="messages" @close="removeMessage" />
  </section>
</template>

<script setup>
import { computed, onActivated, onMounted, ref } from 'vue'
import AdminMessage from '../components/common/AdminMessage.vue'
import ConfirmDialog from '../components/common/ConfirmDialog.vue'
import SettingsPanel from '../components/settings/SettingsPanel.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'
import { useMessages } from '../composables/useMessages'
import {
  cleanupLibraryIndex,
  fetchSettings,
  inspectLibraryIndex,
  scanLibrary,
  updateSetting
} from '../services/api'

const emptyIndexSummary = () => ({
  totalIssues: 0,
  missingComics: 0,
  missingComicCovers: 0,
  invalidChapters: 0,
  invalidPages: 0,
  invalidFolderMetadata: 0,
  invalidFolderCovers: 0,
  invalidProgress: 0,
  invalidCategoryLinks: 0
})

const libraryPath = ref('')
const libraryPathDraft = ref('')
const scanning = ref(false)
const indexBusy = ref('')
const indexSummary = ref(null)

const { acceptConfirmDialog, cancelConfirmDialog, confirm, confirmDialog } = useConfirmDialog()
const { messages, notifyError, notifySuccess, removeMessage } = useMessages()

const indexIssueCount = computed(() => indexSummary.value?.totalIssues || 0)

const loadSettings = async () => {
  const settings = await fetchSettings().catch(() => ({}))
  libraryPath.value = settings.libraryPath || ''
  libraryPathDraft.value = settings.libraryPath || ''
}

const saveLibraryPath = async () => {
  try {
    await updateSetting('libraryPath', libraryPathDraft.value)
    libraryPath.value = libraryPathDraft.value
    indexSummary.value = null
    notifySuccess('漫画库根目录已保存')
  } catch (e) {
    notifyError(e.message || '漫画库根目录保存失败')
  }
}

const scan = async () => {
  scanning.value = true
  try {
    const result = await scanLibrary(libraryPathDraft.value)
    libraryPath.value = libraryPathDraft.value
    indexSummary.value = null
    const movedText = result.index?.movedComics
      ? `，修复 ${result.index.movedComics} 本迁移漫画`
      : ''
    const mergedText = result.index?.mergedStaleComics
      ? `，合并 ${result.index.mergedStaleComics} 个旧索引`
      : ''
    notifySuccess(
      `扫描完成：${result.comicCount} 本，${result.chapterCount} 章，${result.pageCount} 页${movedText}${mergedText}`
    )
    await loadSettings()
  } catch (e) {
    notifyError(e.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

const inspectIndex = async () => {
  indexBusy.value = 'inspect'
  try {
    const result = await inspectLibraryIndex(libraryPathDraft.value)
    indexSummary.value = result.summary
    if (result.summary.totalIssues) {
      notifySuccess(`检查完成：发现 ${result.summary.totalIssues} 个索引问题`)
    } else {
      notifySuccess('检查完成：没有发现无效索引')
    }
  } catch (e) {
    notifyError(e.message || '索引检查失败')
  } finally {
    indexBusy.value = ''
  }
}

const cleanupIndex = async () => {
  const confirmed = await confirm({
    title: '清理无效索引',
    message: '只清理数据库中已经找不到磁盘文件的漫画、章节、图片索引，不会删除磁盘文件。',
    detail: '清理后建议再执行一次扫描同步，让新增或移动后的漫画重新进入索引。',
    confirmText: '开始清理',
    danger: true
  })
  if (!confirmed) return

  indexBusy.value = 'cleanup'
  try {
    const result = await cleanupLibraryIndex(libraryPathDraft.value)
    indexSummary.value = emptyIndexSummary()
    const cleanedCount = Object.values(result.cleaned || {}).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    )
    notifySuccess(`清理完成：处理 ${cleanedCount} 条无效索引`)
  } catch (e) {
    notifyError(e.message || '索引清理失败')
  } finally {
    indexBusy.value = ''
  }
}

onMounted(() => {
  loadSettings()
})

let hasActivated = false
onActivated(() => {
  if (hasActivated) loadSettings()
  hasActivated = true
})
</script>
