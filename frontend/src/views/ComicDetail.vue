<template>
  <main class="shell detail-page">
    <AppTopNav title="漫画详情" eyebrow="Comic" />

    <section v-if="comic" class="detail-hero">
      <div class="detail-cover">
        <img v-if="comic.coverPath" :src="imageUrl(comic.coverPath)" :alt="comic.title" />
      </div>
      <div class="detail-info">
        <p class="eyebrow">Comic</p>
        <h1>{{ comic.title }}</h1>
        <p class="detail-summary">{{ comic.description || '本地漫画库条目' }}</p>
        <div class="detail-actions">
          <button class="secondary-button" @click="toggleFavorite">
            {{ comic.favorite ? '取消收藏' : '收藏' }}
          </button>
          <RouterLink v-if="continueChapterId" class="primary-button" :to="`/reader/${continueChapterId}`">
            继续阅读
          </RouterLink>
          <RouterLink v-else-if="firstChapter" class="primary-button" :to="`/reader/${firstChapter.id}`">
            开始阅读
          </RouterLink>
        </div>
      </div>
    </section>

    <section v-if="comic" class="section-band">
      <div class="section-title">
        <h2>分类</h2>
        <span>{{ comic.categories?.length || 0 }} 个</span>
      </div>
      <div v-if="comic.categories?.length" class="category-editor">
        <span v-for="category in comic.categories" :key="category.id" class="category-chip active">
          {{ category.name }}
        </span>
      </div>
      <div v-else class="empty-state compact">暂未分类</div>
    </section>

    <section class="section-band">
      <div class="section-title">
        <h2>章节</h2>
        <span>{{ chapters.length }} 话</span>
      </div>
      <div v-if="loading" class="empty-state">加载章节...</div>
      <div v-else-if="error" class="empty-state error">{{ error }}</div>
      <div v-else class="chapter-list">
        <RouterLink
          v-for="chapter in chapters"
          :key="chapter.id"
          class="chapter-row"
          :to="`/reader/${chapter.id}`"
        >
          <span>{{ chapter.title }}</span>
          <small>{{ chapter.pageCount }} 页</small>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppTopNav from '../components/AppTopNav.vue'
import {
  fetchComic,
  imageUrl,
  setComicFavorite
} from '../services/api'

const route = useRoute()
const comic = ref(null)
const loading = ref(true)
const error = ref('')

const chapters = computed(() => comic.value?.chapters || [])
const firstChapter = computed(() => chapters.value[0])
const continueChapterId = computed(() => comic.value?.progress?.chapterId || firstChapter.value?.id)

onMounted(async () => {
  loading.value = true
  try {
    const comicData = await fetchComic(route.params.id)
    comic.value = comicData
  } catch (e) {
    error.value = e.message || '漫画加载失败'
  } finally {
    loading.value = false
  }
})

const toggleFavorite = async () => {
  if (!comic.value) return
  const updated = await setComicFavorite(comic.value.id, !comic.value.favorite)
  comic.value = {
    ...comic.value,
    ...updated
  }
}
</script>
