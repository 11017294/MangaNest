<template>
  <main class="admin-shell">
    <header class="admin-topbar">
      <nav class="admin-menu-bar" aria-label="管理菜单">
        <button :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">文件</button>
        <button :class="{ active: activeTab === 'comics' }" @click="activeTab = 'comics'">漫画</button>
        <button :class="{ active: activeTab === 'categories' }" @click="activeTab = 'categories'">分类</button>
        <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">设置</button>
      </nav>
    </header>

    <KeepAlive>
      <component :is="activeView" />
    </KeepAlive>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import AdminCategories from './views/AdminCategories.vue'
import AdminComics from './views/AdminComics.vue'
import AdminFiles from './views/AdminFiles.vue'
import AdminSettings from './views/AdminSettings.vue'

const activeTab = ref('files')
const activeView = computed(() => ({
  files: AdminFiles,
  comics: AdminComics,
  categories: AdminCategories,
  settings: AdminSettings
})[activeTab.value])
</script>
