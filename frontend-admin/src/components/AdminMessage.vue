<template>
  <div v-if="messages.length" class="message-stack" aria-live="polite" aria-atomic="false">
    <button
      v-for="item in messages"
      :key="item.id"
      class="message-toast"
      :class="item.type"
      type="button"
      @click="$emit('close', item.id)"
    >
      <span class="message-toast-icon">{{ item.type === 'error' ? '!' : '✓' }}</span>
      <span>{{ item.text }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  messages: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close'])
</script>
