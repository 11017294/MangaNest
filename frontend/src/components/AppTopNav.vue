<template>
  <header class="app-top-nav">
    <button class="nav-back-button" :aria-label="backLabel" @click="$router.back()">
      <span aria-hidden="true">‹</span>
    </button>
    <div class="nav-title">
      <span v-if="eyebrow">{{ eyebrow }}</span>
      <strong>{{ title }}</strong>
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  eyebrow: {
    type: String,
    default: ''
  },
  backLabel: {
    type: String,
    default: '返回上一页'
  }
})
</script>
