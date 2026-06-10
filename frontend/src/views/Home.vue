<template>
  <main class="shell app-page">
    <section class="home-header">
      <label class="mini-search">
        <input v-model="query" placeholder="搜索漫画" />
      </label>
    </section>

    <section class="quick-entry-grid">
      <RouterLink class="quick-entry ranking" to="/ranking">
        <strong>排行榜</strong>
        <span>按阅读进度和收藏查看</span>
      </RouterLink>
      <RouterLink class="quick-entry categories" to="/categories">
        <strong>分类</strong>
        <span>按题材整理漫画</span>
      </RouterLink>
    </section>

    <section class="section-band">
      <div class="section-title">
        <h2>漫画库</h2>
        <span>{{ filteredComics.length }} 本</span>
      </div>
      <div v-if="loading" class="empty-state">加载中...</div>
      <div v-else-if="!filteredComics.length" class="empty-state">还没有漫画，请到“我的”里设置路径并扫描。</div>
      <div v-else class="comic-grid">
        <ComicCard v-for="comic in filteredComics" :key="comic.id" :comic="comic" />
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
import { fetchComics } from '../services/api'

const comics = ref([])
const query = ref('')
const loading = ref(true)
const ready = computed(() => !loading.value)

const filteredComics = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return comics.value
  return comics.value.filter((comic) => comic.title.toLowerCase().includes(keyword))
})

onMounted(async () => {
  try {
    comics.value = await fetchComics()
  } finally {
    loading.value = false
  }
})

useScrollMemory(ready)
</script>
