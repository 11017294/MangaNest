<template>
  <div class="gallery">

    <!-- 状态 -->
    <div v-if="loading" class="state">加载中...</div>
    <div v-if="error" class="state error">{{ error }}</div>

    <!-- 目录导航 -->
    <div
        v-if="!loading && !error && treeDirectories.length"
        class="nav"
        :class="{ hide: !showNav }"
    >
      <div class="nav-header">
        <span>图片分类</span>
        <button @click="toggleNav">✕</button>
      </div>

      <div class="nav-content">
        <DirectoryTree
            :tree-data="treeDirectories"
            :current-directory="currentDirectory"
            :expanded-states="expandedStates"
            @node-click="switchDirectory"
        />
      </div>
    </div>

    <button
        v-if="!showNav && treeDirectories.length"
        class="nav-btn"
        @click="toggleNav"
    >
      ☰
    </button>

    <!-- 图片列表 -->
    <div v-if="filteredImages.length" class="image-list">
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
        v-if="displayedImages.length < filteredImages.length"
        class="sentinel"
    />

    <div v-if="!loading && !error && !filteredImages.length" class="state">
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

const allImages = ref([])
const displayedImages = ref([])
const loading = ref(true)
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

const fetchImages = async () => {
  try {
    const res = await fetch(`${getBaseUrl()}/api/images`)
    if (!res.ok) throw new Error()

    const data = await res.json()

    data.sort((a,b)=>
        a.name.localeCompare(b.name,undefined,{numeric:true})
    )

    allImages.value = data

    if (directories.value.length) {
      currentDirectory.value = directories.value[0]
    }

    await nextTick()
    loadInitial()

  } catch {
    error.value = '服务器连接失败'
  } finally {
    loading.value = false
  }
}

/* ===================== 目录构建 ===================== */

const directories = computed(()=>{
  const set = new Set()
  allImages.value.forEach(img=>{
    const dir = img.relativePath.substring(
        0,
        img.relativePath.lastIndexOf('\\')
    )
    set.add(dir || '')
  })
  return Array.from(set).sort()
})

const treeDirectories = computed(()=>{
  const map = new Map()

  allImages.value.forEach(img=>{
    const parts = img.relativePath.split('\\')
    let path = ''

    for(let i=0;i<parts.length-1;i++){
      const part = parts[i]
      const parent = path
      path = path ? `${path}\\${part}` : part

      if(!map.has(path)){
        map.set(path,{
          path,
          name:part,
          children:[]
        })
      }
    }
  })

  const roots=[]

  map.forEach((node,path)=>{
    const parts = path.split('\\')
    if(parts.length===1){
      roots.push(node)
    }else{
      const parent = map.get(parts.slice(0,-1).join('\\'))
      parent && parent.children.push(node)
    }
  })

  return roots
})

/* ===================== 过滤 ===================== */

const filteredImages = computed(()=>{
  if(!currentDirectory.value){
    return allImages.value.filter(
        img=>!img.relativePath.includes('\\')
    )
  }

  return allImages.value.filter(img=>
      img.relativePath.startsWith(currentDirectory.value+'\\')
  )
})

/* ===================== 无限滚动 ===================== */

const loadInitial = ()=>{
  displayedImages.value = filteredImages.value.slice(0,initialBatch)
  setupObserver()
}

const loadMore = ()=>{
  if(isLoadingMore.value) return
  if(displayedImages.value.length >= filteredImages.value.length) return

  isLoadingMore.value = true

  const next = filteredImages.value.slice(
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
    root: null,              // 关键：使用 document 作为滚动容器
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

watch(currentDirectory,()=>{
  window.scrollTo({ top: 0, behavior: 'auto' })
  loadInitial()
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

onMounted(fetchImages)
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
}
</style>