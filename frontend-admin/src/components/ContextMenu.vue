<template>
  <div
    v-if="menu.open"
    class="context-menu"
    :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
    @click.stop
    @contextmenu.prevent
  >
    <div class="context-menu-title">{{ menu.title }}</div>
    <button
      v-for="item in menu.items"
      :key="item.label"
      :class="{ danger: item.danger }"
      :disabled="item.disabled"
      @click="$emit('run', item)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  menu: {
    type: Object,
    required: true
  }
})

defineEmits(['run'])
</script>
