<template>
  <RouterLink class="comic-card" :to="`/comic/${comic.id}`">
    <div class="cover-frame">
      <img v-if="comic.coverPath" :src="imageUrl(comic.coverPath)" :alt="comic.title" loading="lazy" />
      <div v-else class="cover-placeholder">{{ comic.title.slice(0, 2) }}</div>
      <span v-if="comic.favorite" class="favorite-badge">收藏</span>
      <span v-if="comic.progress" class="progress-badge">在读</span>
    </div>
    <div class="comic-meta">
      <h3>{{ comic.title }}</h3>
      <p>{{ comic.chapterCount }} 话</p>
    </div>
  </RouterLink>
</template>

<script setup>
import { RouterLink } from 'vue-router'
import { imageUrl } from '../services/api'

defineProps({
  comic: {
    type: Object,
    required: true
  }
})
</script>
