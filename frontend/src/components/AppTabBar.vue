<template>
  <nav class="app-tab-bar">
    <RouterLink to="/" class="tab-link">主页</RouterLink>
    <RouterLink to="/shelf" class="tab-link">书架</RouterLink>
    <RouterLink to="/settings" class="tab-link">我的</RouterLink>
  </nav>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>
