<template>
  <router-view />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const isDev = import.meta.env.DEV
const route = useRoute()
const backendStatus = ref('checking...')

const getBaseUrl = () => {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3001`
}

const pingBackend = async () => {
  try {
    const res = await fetch(`${getBaseUrl()}/api/menus`, { method: 'GET' })
    backendStatus.value = res.ok ? 'ok' : `error ${res.status}`
  } catch (e) {
    backendStatus.value = 'offline'
  }
}

onMounted(() => {
  if (isDev) pingBackend()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
}

body {
  background: #000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

.dev-bar {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 10000;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 4px;
  display: flex;
  gap: 10px;
}
</style>
