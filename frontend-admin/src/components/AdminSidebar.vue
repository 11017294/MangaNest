<template>
  <aside class="sidebar file-sidebar">
    <section class="panel">
      <div class="breadcrumbs">
        <button
          v-for="crumb in breadcrumbs"
          :key="crumb.path"
          :class="{ active: crumb.path === currentPath }"
          @click="$emit('open-folder', crumb.path)"
        >
          {{ crumb.name }}
        </button>
      </div>
      <div class="folder-nav">
        <button
          v-for="dir in folder.folders"
          :key="dir.path"
          @click="$emit('open-folder', dir.path)"
        >
          {{ dir.name }}
        </button>
      </div>
    </section>
  </aside>
</template>

<script setup>
defineProps({
  currentPath: {
    type: String,
    default: ''
  },
  folder: {
    type: Object,
    required: true
  },
  breadcrumbs: {
    type: Array,
    default: () => []
  }
})

defineEmits(['open-folder'])
</script>
