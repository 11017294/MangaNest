<template>
  <main class="shell app-page categories-page">
    <AppTopNav title="分类" eyebrow="Categories" />

    <section class="category-workspace">
      <aside class="category-rail">
        <header class="category-rail-header">
          <div>
            <p class="eyebrow">Library</p>
            <h1>分类</h1>
          </div>
          <span>{{ comics.length }} 本</span>
        </header>

        <label class="category-search" aria-label="搜索漫画或分类">
          <span>搜索</span>
          <input v-model="query" placeholder="漫画名或分类名" />
        </label>

        <div class="category-list-panel">
          <button
            v-for="category in categoryCards"
            :key="category.id"
            class="category-filter-card"
            :class="{ active: activeCategoryId === category.id }"
            @click="activeCategoryId = category.id"
          >
            <span>{{ category.name }}</span>
            <strong>{{ category.count }}</strong>
            <small>{{ category.subtitle }}</small>
          </button>
        </div>
      </aside>

      <section class="category-results">
        <div class="category-results-header">
          <div>
            <p class="eyebrow">{{ activeCategoryId === 'all' ? 'All Comics' : 'Category' }}</p>
            <h2>{{ activeTitle }}</h2>
          </div>
          <span>{{ filteredComics.length }} 本</span>
        </div>

        <div v-if="loading" class="empty-state">加载中...</div>
        <div v-else-if="!filteredComics.length" class="empty-state">
          {{ query.trim() ? '没有找到匹配的漫画' : '这个分类还没有漫画' }}
        </div>
        <div v-else class="comic-grid category-comic-grid">
          <ComicCard v-for="comic in filteredComics" :key="comic.id" :comic="comic" />
        </div>
      </section>
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
const query = ref('')
const loading = ref(true)

const categoryCounts = computed(() => {
  const counts = new Map()
  categories.value.forEach((category) => counts.set(category.id, 0))
  comics.value.forEach((comic) => {
    ;(comic.categories || []).forEach((category) => {
      counts.set(category.id, (counts.get(category.id) || 0) + 1)
    })
  })
  return counts
})

const latestLabel = (items) => {
  const latest = [...items]
    .filter((comic) => comic.lastReadAt)
    .sort((left, right) => new Date(right.lastReadAt) - new Date(left.lastReadAt))[0]
  return latest ? `最近：${latest.title}` : '等待开始阅读'
}

const comicsForCategory = (categoryId) => {
  if (categoryId === 'all') return comics.value
  return comics.value.filter((comic) => {
    return (comic.categories || []).some((category) => category.id === categoryId)
  })
}

const categoryCards = computed(() => {
  const allComics = comicsForCategory('all')
  return [
    {
      id: 'all',
      name: '全部',
      count: allComics.length,
      subtitle: latestLabel(allComics)
    },
    ...categories.value.map((category) => {
      const items = comicsForCategory(category.id)
      return {
        id: category.id,
        name: category.name,
        count: categoryCounts.value.get(category.id) || 0,
        subtitle: items.length ? latestLabel(items) : '暂无漫画'
      }
    })
  ]
})

const activeTitle = computed(() => {
  return categoryCards.value.find((category) => category.id === activeCategoryId.value)?.name || '分类'
})

const filteredComics = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const scopedComics = comicsForCategory(activeCategoryId.value)
  if (!keyword) return scopedComics
  return scopedComics.filter((comic) => {
    const titleMatched = comic.title.toLowerCase().includes(keyword)
    const categoryMatched = (comic.categories || []).some((category) => {
      return category.name.toLowerCase().includes(keyword)
    })
    return titleMatched || categoryMatched
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
