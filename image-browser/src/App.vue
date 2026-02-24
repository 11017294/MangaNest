<template>
  <div id="app">
    <ImageGallery />
  </div>
</template>

<script setup>
import ImageGallery from './components/ImageGallery.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}

body {
  background-color: #000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  width: 100vw;
  max-width: 100vw;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
  width: 100vw;
  max-width: 100vw;
  margin: 0;
  padding: 0;
  background-color: #000;
  overflow-x: hidden;
}
</style>

