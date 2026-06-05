<template>
  <div v-if="dialog.open" class="image-dialog-overlay" @click.self="$emit('close')">
    <section class="image-dialog">
      <header class="image-dialog-header">
        <div>
          <span class="eyebrow">{{ dialog.mode === 'cover' ? 'Choose Cover' : 'Images' }}</span>
          <h2>{{ dialog.comic?.title }}</h2>
        </div>
        <button class="secondary-button" @click="$emit('close')">关闭</button>
      </header>
      <div class="image-dialog-body">
        <aside class="chapter-sidebar">
          <button
            v-for="chapter in dialog.chapters"
            :key="chapter.id"
            :class="{ active: dialog.activeChapterId === chapter.id }"
            @click="$emit('select-chapter', chapter)"
          >
            <strong>{{ chapter.title }}</strong>
            <span>{{ chapter.pageCount || 0 }} 页</span>
          </button>
        </aside>
        <section class="dialog-pages">
          <div v-if="dialog.pageLoading" class="empty-state">加载图片...</div>
          <div v-else-if="!dialog.pages.length" class="empty-state">这个章节没有图片</div>
          <div v-else class="dialog-page-grid">
            <button
              v-for="page in dialog.pages"
              :key="page.id"
              class="dialog-page-tile"
              :class="{ selected: isCurrentCover(page), 'cover-mode': dialog.mode === 'cover' }"
              @click="dialog.mode === 'cover' ? $emit('choose-cover', page) : $emit('preview-page', page)"
              @contextmenu.prevent.stop="$emit('page-context', $event, page)"
            >
              <img :src="imageUrl(page.filePath)" :alt="page.name" loading="lazy" />
              <span>{{ page.name }}</span>
              <small v-if="isCurrentCover(page)" class="cover-selected-label">当前封面</small>
              <small v-else-if="dialog.mode === 'cover'" class="cover-set-label">点击设为封面</small>
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<script setup>
import { imageUrl } from '../services/api'

defineProps({
  dialog: {
    type: Object,
    required: true
  },
  isCurrentCover: {
    type: Function,
    required: true
  }
})

defineEmits([
  'choose-cover',
  'close',
  'page-context',
  'preview-page',
  'select-chapter'
])
</script>
