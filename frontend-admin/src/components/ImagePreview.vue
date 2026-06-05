<template>
  <div v-if="image" class="preview-overlay" @click.self="$emit('close')" @wheel.prevent="$emit('wheel', $event)">
    <button class="preview-close" @click="$emit('close')">关闭</button>
    <button
      v-if="canPrevious"
      class="preview-nav preview-prev"
      aria-label="上一张"
      @click.stop="$emit('shift', -1)"
    >
      ‹
    </button>
    <button
      v-if="canNext"
      class="preview-nav preview-next"
      aria-label="下一张"
      @click.stop="$emit('shift', 1)"
    >
      ›
    </button>
    <div class="preview-click-zone preview-click-prev" @click.stop="$emit('shift', -1)"></div>
    <div class="preview-click-zone preview-click-next" @click.stop="$emit('shift', 1)"></div>
    <img :src="imageUrl(image.path)" :alt="image.name" @click.stop />
    <div class="preview-caption">
      <strong>{{ image.name }}</strong>
      <span>{{ positionLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { imageUrl } from '../services/api'

defineProps({
  image: {
    type: Object,
    default: null
  },
  canPrevious: {
    type: Boolean,
    default: false
  },
  canNext: {
    type: Boolean,
    default: false
  },
  positionLabel: {
    type: String,
    default: ''
  }
})

defineEmits(['close', 'shift', 'wheel'])
</script>
