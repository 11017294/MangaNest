<template>
  <div class="gallery">

    <!-- 状态 -->
    <div v-if="loading" class="state">加载中...</div>
    <div v-if="error" class="state error">{{ error }}</div>

    <!-- 目录导航 -->
    <div
        v-if="!loading && !error && treeData.length"
        class="nav"
        :class="{ hide: !showNav }"
    >
      <div class="nav-header">
        <span>图片分类</span>
        <button @click="toggleNav">✕</button>
      </div>

      <div class="nav-content">
        <DirectoryTree
            :tree-data="treeData"
            :current-directory="currentDirectory"
            :expanded-states="expandedStates"
            @node-click="switchDirectory"
        />
      </div>
    </div>

    <button
        v-if="!showNav && treeData.length"
        class="nav-btn"
        @click="toggleNav"
    >
      ☰
    </button>

    <!-- 图片列表 -->
    <div v-if="currentDirectoryImages.length" class="image-list">
      <div
          v-for="(img,index) in displayedImages"
          :key="img.path + index"
          class="image-item"
      >
        <img
            :src="getImageUrl(img.relativePath)"
            :alt="img.name"
            loading="lazy"
            @error="e => e.target.style.display='none'"
        />
      </div>
    </div>

    <div v-if="isLoadingMore" class="state">加载更多...</div>

    <div
        ref="sentinel"
        v-if="displayedImages.length < currentDirectoryImages.length"
        class="sentinel"
    />

    <div v-if="!loading && !error && !currentDirectoryImages.length" class="state">
      当前目录没有图片
    </div>

  </div>
</template>

<script setup>
import {
  ref,
  computed,
  reactive,
  onMounted,
  onUnmounted,
  nextTick,
  watch
} from 'vue'
import DirectoryTree from './DirectoryTree.vue'

/* ===================== 基础状态 ===================== */

const treeData = ref([])
const currentDirectoryImages = ref([])
const displayedImages = ref([])
const loading = ref(false)
const error = ref('')
const currentDirectory = ref('')
const showNav = ref(true)
const expandedStates = reactive({})
const sentinel = ref(null)

const initialBatch = 30
const batchSize = 30
const isLoadingMore = ref(false)

let observer = null

/* ===================== API ===================== */

const getBaseUrl = () => {
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:3001`
}

// 获取目录结构
const fetchDirectoryTree = async () => {
  try {
    const res = await fetch(`${getBaseUrl()}/api/directories`)
    if (!res.ok) throw new Error()
    treeData.value = await res.json()
  } catch (e) {
    error.value = '加载目录失败'
    console.error(e)
  }
}

// 获取当前目录图片
const fetchImages = async (dir) => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${getBaseUrl()}/api/images?dir=${encodeURIComponent(dir)}`)
    if (!res.ok) throw new Error()

    const data = await res.json()
    // 后端已经排好序了，这里直接使用
    currentDirectoryImages.value = data
    
    // 重置显示
    displayedImages.value = []
    await nextTick()
    loadInitial()

  } catch (e) {
    error.value = '加载图片失败'
    console.error(e)
  } finally {
    loading.value = false
  }
}

/* ===================== 无限滚动 ===================== */

const loadInitial = ()=>{
  displayedImages.value = currentDirectoryImages.value.slice(0,initialBatch)
  setupObserver()
}

const loadMore = ()=>{
  if(isLoadingMore.value) return
  if(displayedImages.value.length >= currentDirectoryImages.value.length) return

  isLoadingMore.value = true

  const next = currentDirectoryImages.value.slice(
      displayedImages.value.length,
      displayedImages.value.length + batchSize
  )

  displayedImages.value = [...displayedImages.value, ...next]

  nextTick(()=>{
    isLoadingMore.value = false
  })
}

const setupObserver = ()=>{
  observer?.disconnect()

  observer = new IntersectionObserver((entries)=>{
    if(entries[0].isIntersecting){
      loadMore()
    }
  },{
    root: null,
    rootMargin: '200px',
    threshold: 0
  })

  sentinel.value && observer.observe(sentinel.value)
}

watch(sentinel,(el)=>{
  if(el && observer){
    observer.observe(el)
  }
})

// 监听目录变化，加载图片
watch(currentDirectory, (newDir)=>{
  window.scrollTo({ top: 0, behavior: 'auto' })
  fetchImages(newDir)
})

/* ===================== 操作 ===================== */

const switchDirectory = (dir)=>{
  currentDirectory.value = dir
  showNav.value = false
}

const toggleNav = ()=> showNav.value = !showNav.value

const getImageUrl = (relativePath)=>{
  return `${getBaseUrl()}/api/image/${encodeURIComponent(relativePath)}`
}

// 初始化
onMounted(async () => {
  loading.value = true
  await fetchDirectoryTree()
  
  if (error.value) {
    loading.value = false
    return
  }

  // 如果有目录，默认选中第一个目录并加载图片
  if (treeData.value.length > 0) {
    const firstDir = treeData.value[0]
    currentDirectory.value = firstDir.path
  } else {
    // 否则加载根目录图片
    fetchImages('')
  }
})

onUnmounted(()=> observer?.disconnect())
</script>

<style scoped>

/* 主容器：自然流，不控制高度 */
.gallery {
  width: 100%;
  background: #000;
}

/* 状态文字 */
.state {
  text-align: center;
  padding: 20px;
  color: #aaa;
}

.error {
  color: #ff6b6b;
}

/* 图片列表 */
.image-list {
  display: flex;
  flex-direction: column;
}

.image-item {
  width: 100%;
}

.image-item img {
  width: 100%;
  height: auto;
  display: block;
}

/* 哨兵 */
.sentinel {
  height: 1px;
}

/* 导航 */
.nav {
  position: fixed;
  top: 15px;
  left: 15px;
  width: 280px;
  max-height: 70vh;
  background: #111;
  border: 1px solid #333;
  border-radius: 12px;
  overflow: hidden;
  transition: transform .3s ease;
}

.nav.hide {
  transform: translateX(-120%);
}

.nav-header {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid #333;
  color: #fff;
}

.nav-content {
  max-height: 60vh;
  overflow-y: auto;
}

.nav-btn {
  position: fixed;
  top: 15px;
  left: 15px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid #333;
  background: #111;
  color: #fff;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1000;
}
</style>