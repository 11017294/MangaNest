<template>
  <section class="panel content-panel">
    <div class="panel-title">
      <h2>文件管理</h2>
      <span>{{ folder.folders.length }} 个目录 · {{ folder.images.length }} 张图片</span>
    </div>

    <nav class="file-path-breadcrumbs" aria-label="当前路径">
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
        <button
          v-if="index < breadcrumbs.length - 1"
          type="button"
          @click="$emit('open-folder', crumb.path)"
        >
          {{ crumb.name }}
        </button>
        <strong v-else>{{ crumb.name }}</strong>
        <span v-if="index < breadcrumbs.length - 1">/</span>
      </template>
    </nav>

    <div v-if="folderLoading" class="empty-state">加载目录...</div>
    <div v-else class="file-grid">
      <article
        v-for="dir in folder.folders"
        :key="dir.path"
        class="folder-card"
        draggable="true"
        @contextmenu.prevent.stop="$emit('context', $event, dir, 'folder')"
        @dragstart="$emit('drag-start', dir)"
        @dragover.prevent
        @drop.prevent="$emit('drop-folder', dir)"
      >
        <button class="thumb folder-thumb" @click="$emit('open-folder', dir.path)">
          <img v-if="dir.coverImage" :src="imageUrl(dir.coverImage)" alt="" loading="lazy" />
          <span v-else>无图片</span>
          <small class="type-badge" aria-label="文件夹">DIR</small>
        </button>
        <input
          :value="dir.name"
          class="name-input"
          @change="$emit('rename', dir.path, $event.target.value)"
        />
      </article>

      <article
        v-for="image in folder.images"
        :key="image.path"
        class="image-card"
        @contextmenu.prevent.stop="$emit('context', $event, image, 'image')"
      >
        <button class="thumb" @click="$emit('preview-image', image)">
          <img :src="imageUrl(image.path)" :alt="image.name" loading="lazy" />
        </button>
        <input
          :value="image.name"
          class="name-input"
          @change="$emit('rename', image.path, $event.target.value)"
        />
      </article>
    </div>
  </section>
</template>

<script setup>
import { imageUrl } from '../services/api'

defineProps({
  folder: {
    type: Object,
    required: true
  },
  folderLoading: {
    type: Boolean,
    default: false
  },
  breadcrumbs: {
    type: Array,
    default: () => []
  }
})

defineEmits([
  'context',
  'drag-start',
  'drop-folder',
  'open-folder',
  'preview-image',
  'rename'
])
</script>
