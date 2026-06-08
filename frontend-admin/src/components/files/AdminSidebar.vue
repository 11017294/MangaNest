<template>
  <aside class="sidebar file-sidebar">
    <section class="panel">
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
  folder: {
    type: Object,
    required: true
  }
})

defineEmits(['open-folder'])
</script>
