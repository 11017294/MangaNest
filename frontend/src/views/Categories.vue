<template>
  <main class="shell app-page">
    <AppTopNav title="分类" eyebrow="Categories" />
    <section class="top-panel compact-panel">
      <div>
        <p class="eyebrow">Categories</p>
        <h1>分类</h1>
      </div>
    </section>

    <nav class="filter-strip">
      <button :class="{ active: activeCategoryId === 'all' }" @click="activeCategoryId = 'all'">全部</button>
      <button
        v-for="category in categories"
        :key="category.id"
        :class="{ active: activeCategoryId === category.id }"
        @click="activeCategoryId = category.id"
      >
        {{ category.name }}
      </button>
    </nav>

    <section class="section-band">
      <div class="section-title">
        <h2>{{ activeTitle }}</h2>
        <span>{{ filteredComics.length }} 本</span>
      </div>
      <div v-if="loading" class="empty-state">加载中...</div>
      <div v-else-if="!filteredComics.length" class="empty-state">这个分类还没有漫画</div>
      <div v-else class="comic-grid">
        <ComicCard v-for="comic in filteredComics" :key="comic.id" :comic="comic" />
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppTopNav from '../components/AppTopNav.vue'
import ComicCard from '../components/ComicCard.vue'
import { fetchCategories, fetchComics } from '../services/api'

const comics = ref([])
const categories = ref([])
const activeCategoryId = ref('all')
const loading = ref(true)

const activeTitle = computed(() => {
  if (activeCategoryId.value === 'all') return '全部分类'
  return categories.value.find((category) => category.id === activeCategoryId.value)?.name || '分类'
})

const filteredComics = computed(() => {
  if (activeCategoryId.value === 'all') return comics.value
  return comics.value.filter((comic) => {
    return (comic.categories || []).some((category) => category.id === activeCategoryId.value)
  })
})

onMounted(async () => {
  try {
    const [comicData, categoryData] = await Promise.all([
      fetchComics().catch(() => []),
      fetchCategories().catch(() => [])
    ])
    comics.value = comicData
    categories.value = categoryData
  } finally {
    loading.value = false
  }
})
</script>
