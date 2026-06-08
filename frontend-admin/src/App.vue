<template>
  <main class="admin-shell">
    <AdminTopbar
      :active-tab="activeTab"
      :menu-items="menuItems"
      @update:active-tab="openMenu"
      @open-search-result="openSearchResult"
    />

    <RouterView v-slot="{ Component }">
      <KeepAlive>
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import type { AdminSearchResult } from '@shared/types/api'
import AdminTopbar from '@/components/common/AdminTopbar.vue'
import { adminMenuItems } from '@/router'

const route = useRoute()
const router = useRouter()
const menuItems = adminMenuItems
const activeTab = computed(() => String(route.name || 'files'))

const openMenu = (key: string) => {
  const target = menuItems.find((item) => item.key === key)
  if (!target) return
  router.push(target.path)
}

const openSearchResult = (item: AdminSearchResult) => {
  router.push({
    name: 'files',
    query: {
      path: item.path,
      request: String(Date.now())
    }
  })
}
</script>
