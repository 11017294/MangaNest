<template>
  <section class="panel content-panel file-manager-panel">
    <div class="file-manager-toolbar">
      <nav class="file-path-breadcrumbs" aria-label="当前路径">
        <span class="breadcrumb-main">
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
            <button
              v-if="index < breadcrumbs.length - 1"
              type="button"
              @click="$emit('open-folder', crumb.path)"
              @dragover.prevent
              @drop.prevent="$emit('drop-target', crumb)"
            >
              {{ crumb.name }}
            </button>
            <strong v-else>{{ crumb.name }}</strong>
            <span v-if="index < breadcrumbs.length - 1">/</span>
          </template>
        </span>
        <span class="breadcrumb-count">
          {{ visibleFolders.length }} 个目录 · {{ visibleImages.length }} 个文件
        </span>
      </nav>
      <input
        class="file-filter-input"
        :value="filterText"
        placeholder="筛选当前目录"
        @input="$emit('update:filter-text', $event.target.value)"
      />
      <button
        class="management-toggle"
        type="button"
        :class="{ active: hideMarked }"
        @click="$emit('toggle-hide-marked', !hideMarked)"
      >
        {{ hideMarked ? '整理中' : '整理模式' }}
      </button>
    </div>

    <div class="file-manager-scroll" @contextmenu.prevent.self="$emit('blank-context', $event)">
      <div v-if="folderLoading" class="empty-state">加载目录...</div>
      <div v-else class="file-grid" @contextmenu.prevent.self="$emit('blank-context', $event)">
        <FileItemCard
          v-for="dir in visibleFolders"
          :key="dir.path"
          :editing="editingPath === dir.path"
          :item="dir"
          :selected="selectedPaths.includes(dir.path)"
          type="folder"
          @context="$emit('context', $event, dir, 'folder')"
          @drag-card="handleCardDragStart"
          @drop-folder="$emit('drop-target', { path: dir.path, name: dir.name })"
          @edit-start="editingPath = dir.path"
          @edit-stop="editingPath = ''"
          @open="openDirectory(dir, $event)"
          @rename="$emit('rename', dir.path, $event)"
          @select="$emit('select-item', $event, dir, 'folder')"
        />

        <FileItemCard
          v-for="image in visibleImages"
          :key="image.path"
          :editing="editingPath === image.path"
          :item="image"
          :selected="selectedPaths.includes(image.path)"
          type="image"
          @context="$emit('context', $event, image, 'image')"
          @drag-card="handleCardDragStart"
          @edit-start="editingPath = image.path"
          @edit-stop="editingPath = ''"
          @open="openImage(image, $event)"
          @rename="$emit('rename', image.path, $event)"
          @select="$emit('select-item', $event, image, 'image')"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import FileItemCard from './FileItemCard.vue'

const emit = defineEmits([
  'blank-context',
  'context',
  'drag-start',
  'drop-target',
  'open-folder',
  'preview-image',
  'rename',
  'select-item',
  'toggle-hide-marked',
  'update:filter-text'
])

const editingPath = ref('')

const shouldSelectOnly = (event) => event.ctrlKey || event.shiftKey || event.metaKey

const openDirectory = (dir, event) => {
  if (shouldSelectOnly(event)) emit('select-item', event, dir, 'folder')
  else emit('open-folder', dir.path)
}

const openImage = (image, event) => {
  if (shouldSelectOnly(event)) emit('select-item', event, image, 'image')
  else emit('preview-image', image)
}

const handleCardDragStart = (event, item, type) => {
  if (editingPath.value === item.path) {
    event.preventDefault()
    return
  }
  emit('drag-start', item, type)
}

defineProps({
  folderLoading: {
    type: Boolean,
    default: false
  },
  breadcrumbs: {
    type: Array,
    default: () => []
  },
  selectedPaths: {
    type: Array,
    default: () => []
  },
  filterText: {
    type: String,
    default: ''
  },
  hideMarked: {
    type: Boolean,
    default: false
  },
  visibleFolders: {
    type: Array,
    default: () => []
  },
  visibleImages: {
    type: Array,
    default: () => []
  }
})

</script>
