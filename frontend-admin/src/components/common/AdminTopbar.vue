<template>
  <header class="admin-topbar">
    <nav class="admin-menu-list" aria-label="管理菜单">
      <button
        v-for="item in menuItems"
        :key="item.key"
        type="button"
        :class="{ active: activeTab === item.key }"
        @click="emit('update:active-tab', item.key)"
      >
        {{ item.label }}
      </button>
    </nav>

    <div class="admin-global-search" @keydown.esc="closeSearchPanel">
      <input
        v-model="searchText"
        class="admin-global-search-input"
        placeholder="搜索文件夹名称"
        @focus="searchPanelOpen = true"
        @input="scheduleSearch"
      />
      <section v-if="searchPanelOpen && shouldShowPanel" class="admin-search-panel">
        <div v-if="searching" class="admin-search-empty">搜索中...</div>
        <div v-else-if="searchError" class="admin-search-empty error">{{ searchError }}</div>
        <div v-else-if="!searchResults.length" class="admin-search-empty">没有匹配的文件夹</div>
        <template v-else>
          <button
            v-for="item in searchResults"
            :key="`${item.type}:${item.path}`"
            class="admin-search-result"
            type="button"
            @mousedown.prevent="openResult(item)"
          >
            <span class="admin-search-type">DIR</span>
            <span class="admin-search-main">
              <strong>{{ item.name }}</strong>
              <small>{{ item.path }}</small>
            </span>
          </button>
        </template>
      </section>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { AdminSearchResult } from '@shared/types/api'
import { searchAdminFiles } from '@/services/api'

interface MenuItem {
  key: string
  label: string
  path?: string
}

defineProps<{
  activeTab: string
  menuItems: MenuItem[]
}>()

const emit = defineEmits<{
  'open-search-result': [item: AdminSearchResult]
  'update:active-tab': [key: string]
}>()

const searchText = ref('')
const searchResults = ref<AdminSearchResult[]>([])
const searching = ref(false)
const searchError = ref('')
const searchPanelOpen = ref(false)
let searchTimer: number | null = null
let searchSeq = 0

const cleanSearchText = computed(() => searchText.value.trim())
const shouldShowPanel = computed(() => cleanSearchText.value.length > 0)

const runSearch = async () => {
  const query = cleanSearchText.value
  if (!query) {
    searchResults.value = []
    searchError.value = ''
    searching.value = false
    return
  }

  const seq = ++searchSeq
  searching.value = true
  searchError.value = ''
  try {
    const data = await searchAdminFiles(query, 60)
    if (seq !== searchSeq) return
    searchResults.value = data.results || []
  } catch (e) {
    if (seq !== searchSeq) return
    searchResults.value = []
    searchError.value = e instanceof Error ? e.message : '搜索失败'
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

const scheduleSearch = () => {
  searchPanelOpen.value = true
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(runSearch, 220)
}

const openResult = (item: AdminSearchResult) => {
  emit('open-search-result', item)
  searchPanelOpen.value = false
}

const closeSearchPanel = () => {
  searchPanelOpen.value = false
}

onBeforeUnmount(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
})
</script>
