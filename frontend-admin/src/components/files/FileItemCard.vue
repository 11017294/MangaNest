<template>
  <article
    :class="cardClass"
    :draggable="!editing"
    @click="$emit('select', $event)"
    @contextmenu.prevent.stop="$emit('context', $event)"
    @dragstart="$emit('drag-card', $event, item, type)"
    @dragover.prevent="isFolder"
    @drop.prevent.stop="isFolder && $emit('drop-folder')"
  >
    <button class="thumb" :class="{ 'folder-thumb': isFolder }" @click.stop="$emit('open', $event)">
      <img v-if="coverPath" :src="imageUrl(coverPath)" :alt="item.name" loading="lazy" />
      <span v-else-if="isFolder">无图片</span>
      <small v-if="isFolder" class="type-badge" aria-label="文件夹">DIR</small>
      <small v-if="isFolder && item.marked" class="mark-badge" aria-label="已标记">已标记</small>
    </button>

    <input
      :value="item.name"
      class="name-input"
      draggable="false"
      @blur="$emit('edit-stop')"
      @change="$emit('rename', $event.target.value)"
      @click.stop
      @drag.stop
      @dragstart.stop
      @focus="$emit('edit-start')"
      @mousedown="startNameEdit"
      @mousemove.stop
      @pointerdown="startNameEdit"
    />
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { imageUrl } from '../../services/api'

const props = defineProps({
  editing: {
    type: Boolean,
    default: false
  },
  item: {
    type: Object,
    required: true
  },
  selected: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    required: true
  }
})

const emit = defineEmits([
  'context',
  'drag-card',
  'drop-folder',
  'edit-start',
  'edit-stop',
  'open',
  'rename',
  'select'
])

const isFolder = computed(() => props.type === 'folder')
const coverPath = computed(() => (isFolder.value ? props.item.coverImage : props.item.path))
const cardClass = computed(() => [
  isFolder.value ? 'folder-card' : 'image-card',
  {
    selected: props.selected,
    'name-editing': props.editing
  }
])

const startNameEdit = (event) => {
  emit('edit-start')
  event.stopPropagation()
}
</script>
