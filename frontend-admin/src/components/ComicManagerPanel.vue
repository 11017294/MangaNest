<template>
  <section class="panel content-panel">
    <div class="panel-title">
      <h2>漫画管理</h2>
      <span>{{ comics.length }} 本</span>
    </div>
    <input :value="query" class="search-input" placeholder="搜索漫画标题" @input="$emit('update:query', $event.target.value)" />
    <div class="bulk-toolbar">
      <label class="select-all-control">
        <input type="checkbox" :checked="allSelected" @change="$emit('toggle-all', $event.target.checked)" />
        全选
      </label>
      <button class="danger-button" :disabled="!selectedComicIds.length" @click="$emit('remove-selected')">
        批量删除索引
      </button>
      <span>{{ selectedComicIds.length }} 项已选</span>
    </div>
    <div class="comic-table">
      <article
        v-for="comic in comics"
        :key="comic.id"
        class="comic-row"
        @contextmenu.prevent.stop="$emit('context', $event, comic)"
      >
        <input
          class="comic-select"
          type="checkbox"
          :checked="selectedComicIds.includes(comic.id)"
          @change="$emit('toggle-selection', comic.id, $event.target.checked)"
        />
        <button class="comic-cover-button" @click="$emit('open-images', comic, 'view')">
          <img v-if="comic.coverPath" :src="imageUrl(comic.coverPath)" alt="" loading="lazy" />
          <span v-else>无封面</span>
        </button>
        <div class="comic-main">
          <strong>{{ comic.title }}</strong>
          <span>{{ comic.chapterCount }} 章</span>
          <div class="comic-category-summary">
            <span
              v-for="category in comic.categories || []"
              :key="category.id"
              class="comic-category-chip"
            >
              {{ category.name }}
            </span>
            <span v-if="!comic.categories?.length" class="muted-chip">未分类</span>
          </div>
        </div>
        <div class="comic-actions">
          <button @click="$emit('open-category-dialog', comic)">管理分类</button>
          <button @click="$emit('open-images', comic, 'view')">显示图片</button>
          <button @click="$emit('open-images', comic, 'cover')">设置封面</button>
          <button class="danger-button" @click="$emit('remove-index', comic)">删索引</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { imageUrl } from '../services/api'

defineProps({
  comics: {
    type: Array,
    default: () => []
  },
  query: {
    type: String,
    default: ''
  },
  selectedComicIds: {
    type: Array,
    default: () => []
  },
  allSelected: {
    type: Boolean,
    default: false
  }
})

defineEmits([
  'context',
  'open-category-dialog',
  'open-images',
  'remove-index',
  'remove-selected',
  'toggle-all',
  'toggle-selection',
  'update:query'
])
</script>
