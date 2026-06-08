<template>
  <section class="workspace">
    <SettingsPanel
      v-model:library-path-draft="libraryPathDraft"
      :library-path="libraryPath"
      :scanning="scanning"
      @save="saveLibraryPath"
      @scan="scan"
    />

    <AdminMessage :messages="messages" @close="removeMessage" />
  </section>
</template>

<script setup>
import { onActivated, onMounted, ref } from 'vue'
import AdminMessage from '../components/common/AdminMessage.vue'
import SettingsPanel from '../components/settings/SettingsPanel.vue'
import { useMessages } from '../composables/useMessages'
import {
  fetchSettings,
  scanLibrary,
  updateSetting
} from '../services/api'

const libraryPath = ref('')
const libraryPathDraft = ref('')
const scanning = ref(false)

const { messages, notifyError, notifySuccess, removeMessage } = useMessages()

const loadSettings = async () => {
  const settings = await fetchSettings().catch(() => ({}))
  libraryPath.value = settings.libraryPath || ''
  libraryPathDraft.value = settings.libraryPath || ''
}

const saveLibraryPath = async () => {
  try {
    await updateSetting('libraryPath', libraryPathDraft.value)
    libraryPath.value = libraryPathDraft.value
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
    notifySuccess(`扫描完成：${result.comicCount} 本，${result.chapterCount} 章，${result.pageCount} 页`)
    await loadSettings()
  } catch (e) {
    notifyError(e.message || '扫描失败')
  } finally {
    scanning.value = false
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
