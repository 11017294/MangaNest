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
        <article
          v-for="dir in visibleFolders"
          :key="dir.path"
          class="folder-card"
          :class="{ selected: selectedPaths.includes(dir.path), 'name-editing': editingPath === dir.path }"
          :draggable="editingPath !== dir.path"
          @contextmenu.prevent.stop="$emit('context', $event, dir, 'folder')"
          @click="$emit('select-item', $event, dir, 'folder')"
          @dragstart="handleCardDragStart($event, dir, 'folder')"
          @dragover.prevent
          @drop.prevent.stop="$emit('drop-target', { path: dir.path, name: dir.name })"
        >
          <button
            class="thumb folder-thumb"
            @click.stop="$event.ctrlKey || $event.shiftKey || $event.metaKey ? $emit('select-item', $event, dir, 'folder') : $emit('open-folder', dir.path)"
          >
            <img v-if="dir.coverImage" :src="imageUrl(dir.coverImage)" alt="" loading="lazy" />
            <span v-else>无图片</span>
            <small class="type-badge" aria-label="文件夹">DIR</small>
            <small v-if="dir.marked" class="mark-badge" aria-label="已标记">已标记</small>
          </button>
          <input
            :value="dir.name"
            class="name-input"
            draggable="false"
            @change="$emit('rename', dir.path, $event.target.value)"
            @click.stop
            @drag.stop
            @dragstart.stop
            @blur="editingPath = ''"
            @focus="editingPath = dir.path"
            @mousedown="beginNameEdit($event, dir.path)"
            @mousemove.stop
            @pointerdown="beginNameEdit($event, dir.path)"
          />
        </article>

        <article
          v-for="image in visibleImages"
          :key="image.path"
          class="image-card"
          :class="{ selected: selectedPaths.includes(image.path), 'name-editing': editingPath === image.path }"
          :draggable="editingPath !== image.path"
          @contextmenu.prevent.stop="$emit('context', $event, image, 'image')"
          @click="$emit('select-item', $event, image, 'image')"
          @dragstart="handleCardDragStart($event, image, 'image')"
        >
          <button
            class="thumb"
            @click.stop="$event.ctrlKey || $event.shiftKey || $event.metaKey ? $emit('select-item', $event, image, 'image') : $emit('preview-image', image)"
          >
            <img :src="imageUrl(image.path)" :alt="image.name" loading="lazy" />
          </button>
          <input
            :value="image.name"
            class="name-input"
            draggable="false"
            @change="$emit('rename', image.path, $event.target.value)"
            @click.stop
            @drag.stop
            @dragstart.stop
            @blur="editingPath = ''"
            @focus="editingPath = image.path"
            @mousedown="beginNameEdit($event, image.path)"
            @mousemove.stop
            @pointerdown="beginNameEdit($event, image.path)"
          />
        </article>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { imageUrl } from '../services/api'

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

const beginNameEdit = (event, path) => {
  editingPath.value = path
  event.stopPropagation()
}

const handleCardDragStart = (event, item, type) => {
  if (editingPath.value === item.path) {
    event.preventDefault()
    return
  }
  emit('drag-start', item, type)
}

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
