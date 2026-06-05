<template>
  <main class="shell app-page">
    <AppTopNav title="排行榜" eyebrow="Ranking" />
    <section class="top-panel compact-panel">
      <div>
        <p class="eyebrow">Ranking</p>
        <h1>排行榜</h1>
      </div>
    </section>

    <section class="section-band">
      <div v-if="loading" class="empty-state">加载中...</div>
      <div v-else-if="!rankedComics.length" class="empty-state">暂无漫画</div>
      <div v-else class="ranking-list">
        <RouterLink
          v-for="(comic, index) in rankedComics"
          :key="comic.id"
          class="ranking-row"
          :to="`/comic/${comic.id}`"
        >
          <strong>{{ index + 1 }}</strong>
          <img :src="imageUrl(comic.coverPath)" alt="" loading="lazy" />
          <div>
            <h3>{{ comic.title }}</h3>
            <span>
              {{ comic.favorite ? '收藏' : '未收藏' }}
              · 阅读 {{ comic.readCount || 0 }} 次
              · 分数 {{ comic.rankingScore || 0 }}
            </span>
            <small v-if="comic.lastReadAt">最近 {{ formatDate(comic.lastReadAt) }}</small>
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
import { fetchRanking, imageUrl } from '../services/api'

const rankedComics = ref([])
const loading = ref(true)

const formatDate = (value) => new Date(value).toLocaleDateString()

onMounted(async () => {
  try {
    rankedComics.value = await fetchRanking()
  } finally {
    loading.value = false
  }
})
</script>
