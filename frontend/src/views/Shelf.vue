<template>
  <main class="shell app-page shelf-page">
    <nav class="segmented-tabs">
      <button :class="{ active: tab === 'favorite' }" @click="tab = 'favorite'">收藏</button>
      <button :class="{ active: tab === 'history' }" @click="tab = 'history'">历史</button>
    </nav>

    <section v-if="tab === 'favorite'" class="section-band">
      <div class="section-title">
        <h2>我的收藏</h2>
        <span>{{ favorites.length }} 本</span>
      </div>
      <div v-if="loading" class="empty-state">加载中...</div>
      <div v-else-if="!favorites.length" class="empty-state">还没有收藏</div>
      <div v-else class="comic-grid">
        <ComicCard v-for="comic in favorites" :key="comic.id" :comic="comic" />
      </div>
    </section>

    <section v-else class="section-band">
      <div class="section-title">
        <h2>阅读历史</h2>
        <span>{{ recentItems.length }} 条</span>
      </div>
      <div v-if="loading" class="empty-state">加载中...</div>
      <div v-else-if="!recentItems.length" class="empty-state">还没有阅读记录</div>
      <div v-else class="recent-list">
        <RouterLink
          v-for="item in recentItems"
          :key="item.id"
          class="recent-row"
          :to="`/reader/${item.chapterId}`"
        >
          <img :src="imageUrl(item.comic?.coverPath)" alt="" loading="lazy" />
          <div>
            <strong>{{ item.comic?.title }}</strong>
            <span>{{ item.chapter?.title }} · 第 {{ item.pageIndex + 1 }} 页</span>
            <small>{{ formatDate(item.updatedAt) }}</small>
          </div>
        </RouterLink>
      </div>
    </section>

    <AppTabBar />
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppTabBar from '../components/AppTabBar.vue'
import ComicCard from '../components/ComicCard.vue'
import { useScrollMemory } from '../composables/useScrollMemory'
import { fetchComics, fetchRecent, imageUrl } from '../services/api'

const comics = ref([])
const recentItems = ref([])
const loading = ref(true)
const tab = ref('favorite')
const ready = computed(() => !loading.value)

const favorites = computed(() => comics.value.filter((comic) => comic.favorite))

const formatDate = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

onMounted(async () => {
  try {
    const [comicData, recentData] = await Promise.all([
      fetchComics().catch(() => []),
      fetchRecent().catch(() => [])
    ])
    comics.value = comicData
    recentItems.value = recentData
  } finally {
    loading.value = false
  }
})

useScrollMemory(ready, () => `/shelf?tab=${tab.value}`)
</script>
