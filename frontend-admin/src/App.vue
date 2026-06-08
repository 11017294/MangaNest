<template>
  <main class="admin-shell">
    <AdminTopbar
      v-model:active-tab="activeTab"
      :menu-items="menuItems"
      @open-search-result="openSearchResult"
    />

    <KeepAlive>
      <component :is="activeView" v-bind="activeViewProps" />
    </KeepAlive>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import AdminTopbar from './components/common/AdminTopbar.vue'
import AdminCategories from './views/AdminCategories.vue'
import AdminComics from './views/AdminComics.vue'
import AdminFiles from './views/AdminFiles.vue'
import AdminSettings from './views/AdminSettings.vue'

const activeTab = ref('files')
const fileOpenRequest = ref(null)
const menuItems = [
  { key: 'files', label: '文件管理' },
  { key: 'comics', label: '漫画管理' },
  { key: 'categories', label: '分类管理' },
  { key: 'settings', label: '系统设置' }
]
const activeView = computed(() => ({
  files: AdminFiles,
  comics: AdminComics,
  categories: AdminCategories,
  settings: AdminSettings
})[activeTab.value])
const activeViewProps = computed(() => (
  activeTab.value === 'files'
    ? { openPathRequest: fileOpenRequest.value }
    : {}
))

const openSearchResult = (item) => {
  activeTab.value = 'files'
  fileOpenRequest.value = {
    id: Date.now(),
    path: item.path
  }
}
</script>
