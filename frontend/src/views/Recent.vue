<template>
  <main class="shell recent-page">
    <AppTopNav title="最近阅读" eyebrow="History" />
    <section class="top-panel compact-panel">
      <div>
        <p class="eyebrow">History</p>
        <h1>最近阅读</h1>
      </div>
      <RouterLink class="secondary-button" to="/">书架</RouterLink>
    </section>

    <section class="section-band">
      <div v-if="loading" class="empty-state">读取记录中...</div>
      <div v-else-if="!items.length" class="empty-state">还没有阅读记录</div>
      <div v-else class="recent-list">
        <RouterLink
          v-for="item in items"
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
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppTopNav from '../components/AppTopNav.vue'
import { fetchRecent, imageUrl } from '../services/api'

const items = ref([])
const loading = ref(true)

const formatDate = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

onMounted(async () => {
  try {
    items.value = await fetchRecent()
  } finally {
    loading.value = false
  }
})
</script>
