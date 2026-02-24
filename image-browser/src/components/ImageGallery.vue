<template>
  <div class="image-gallery">
    <div class="loading" v-if="loading">
      加载中...
    </div>

    <div class="error" v-if="error">
      {{ error }}
    </div>

    <!-- 树形目录导航栏 -->
    <div
        class="directory-nav"
        :class="{ 'hidden': !showNav }"
        v-if="!loading && !error && treeDirectories.length > 0"
    >
      <div class="nav-header">
        <span class="nav-title">图片分类</span>
        <button class="toggle-btn" @click="toggleNav">✕</button>
      </div>
      <div class="nav-items">
        <DirectoryTree
            :tree-data="treeDirectories"
            :current-directory="currentDirectory"
            :expanded-states="expandedStates"
            @node-click="switchDirectory"
        />
      </div>
    </div>

    <!-- 切换按钮（当导航栏隐藏时显示） -->
    <button
        class="show-nav-btn"
        v-if="!showNav && !loading && !error && treeDirectories.length > 0"
        @click="toggleNav"
    >
      ☰
    </button>

    <!-- 图片列表 -->
    <div class="image-list" v-if="!loading && !error && filteredImages.length > 0">
      <div
          class="image-item"
          v-for="(image, index) in displayedImages"
          :key="`${image.path}-${index}`"
          :data-index="index"
      >
        <img
            :src="getImageUrl(image.relativePath)"
            :alt="image.name"
            loading="lazy"
            @load="onImageLoad"
            @error="onImageError"
        />
      </div>
    </div>

    <div class="loading-more" v-if="isLoadingMore && !loading">
      加载更多图片...
    </div>

    <!-- 观察哨兵元素，用于触发无限滚动 -->
    <div ref="sentinel" class="sentinel" v-if="displayedImages.length < filteredImages.length"></div>

    <div class="no-more" v-if="displayedImages.length >= filteredImages.length && filteredImages.length > 0">
      没有更多图片了
    </div>

    <div class="no-images" v-if="!loading && !error && filteredImages.length === 0">
      该目录下未找到图片文件
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue'
import DirectoryTree from './DirectoryTree.vue'

const allImages = ref([]) // 所有图片
const displayedImages = ref([]) // 当前显示的图片
const loading = ref(true)
const error = ref('')
const isLoadingMore = ref(false)
const initialBatchSize = 30 // 初始加载30张图片
const batchSize = 30 // 每次加载30张图片
const currentDirectory = ref('') // 当前选中的目录
const showNav = ref(true) // 控制导航栏显示/隐藏
const expandedStates = reactive({}) // 响应式的展开状态
const loadedImagePaths = new Set() // 记录已加载的图片路径，避免重复加载
const sentinel = ref(null) // 观察哨兵
let observer = null

// 切换导航栏显示状态
const toggleNav = () => {
  showNav.value = !showNav.value
}

// 动态获取基础URL
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    return `${protocol}//${hostname}:3001`
  }
  return 'http://192.168.23.51:3001'
}

// 获取所有图片列表
const fetchAllImages = async () => {
  try {
    loading.value = true
    error.value = ''

    const baseUrl = getBaseUrl()
    const response = await fetch(`${baseUrl}/api/images`)
    if (!response.ok) {
      throw new Error('获取图片失败')
    }

    const imageData = await response.json()
    // 按文件名自然排序 (Natural Sort)，确保 1.jpg, 2.jpg, 10.jpg 顺序正确
    imageData.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    allImages.value = imageData

    if (directories.value.length > 0) {
      currentDirectory.value = directories.value[0]
    }

    // 等待DOM更新完成后再加载图片
    await nextTick()
    setTimeout(() => {
      loadInitialBatch()
      // 初始加载后启动观察者
      nextTick(() => {
        setupIntersectionObserver()
      })
    }, 100)

  } catch (err) {
    error.value = '无法连接到服务器，请确保后端服务正在运行'
    console.error('Error fetching images:', err)
  } finally {
    loading.value = false
  }
}

// 初始加载批次
const loadInitialBatch = () => {
  // 清空已加载记录
  loadedImagePaths.clear()
  // 重置加载状态，防止loadNextBatch因isLoadingMore为true而提前返回
  isLoadingMore.value = false
  
  // 获取第一批数据
  const initialImages = filteredImages.value.slice(0, initialBatchSize)
  
  // 记录已加载的图片路径
  initialImages.forEach(image => {
    console.log(`初始加载了 ${image.path} 张图片`)
    loadedImagePaths.add(image.path)
  })

  // 直接赋值，不依赖loadNextBatch，避免状态竞争
  displayedImages.value = [...initialImages]

  console.log(`初始加载了 ${initialImages.length} 张图片`)
}

// 设置IntersectionObserver
const setupIntersectionObserver = () => {
  if (observer) {
    observer.disconnect()
  }

  observer = new IntersectionObserver((entries) => {
    // 如果哨兵元素可见，并且没有正在加载，且还有更多图片
    if (entries[0].isIntersecting && !isLoadingMore.value && displayedImages.value.length < filteredImages.value.length) {
      loadNextBatch()
    }
  }, {
    rootMargin: '200px', // 提前200px开始加载
    threshold: 0.1
  })

  // 如果此时sentinel已经存在，直接开始观察
  if (sentinel.value) {
    observer.observe(sentinel.value)
  }
}

// 监听哨兵元素变化，确保始终被观察
watch(sentinel, (el) => {
  if (el && observer) {
    observer.observe(el)
  }
})

// 加载下一批图片
const loadNextBatch = (count = batchSize) => {
  if (isLoadingMore.value) return
  
  const currentLength = displayedImages.value.length
  if (currentLength >= filteredImages.value.length) return

  isLoadingMore.value = true

  // 获取下一批未加载的图片
  const nextBatch = filteredImages.value.slice(currentLength, currentLength + count)
  
  if (nextBatch.length > 0) {
    // 过滤掉已加载的（虽然理论上切片不会重复，但为了安全起见）
    const newImages = nextBatch.filter(img => !loadedImagePaths.has(img.path))
    
    newImages.forEach(img => loadedImagePaths.add(img.path))
    
    // 使用非响应式的方式先合并数组，再一次性更新，减少渲染次数
    // 注意：Vue 3中直接赋值给.value通常比push更高效，尤其是大数组
    displayedImages.value = [...displayedImages.value, ...newImages]
    
    console.log(`加载了 ${newImages.length} 张图片, 当前共显示 ${displayedImages.value.length} 张`)
  }

  // 快速重置加载状态，允许下一次触发
  // 使用nextTick确保DOM更新后再重置，避免IntersectionObserver过于频繁触发
  nextTick(() => {
    isLoadingMore.value = false
  })
}

// 获取扁平化的目录列表（用于向后兼容）
const directories = computed(() => {
  const dirs = new Set()
  allImages.value.forEach(image => {
    const dirPath = image.relativePath.substring(0, image.relativePath.lastIndexOf('\\'))
    dirs.add(dirPath || '')
  })
  return Array.from(dirs).sort()
})

// 构建树形目录结构
const treeDirectories = computed(() => {
  const dirMap = new Map()

  // 先收集所有目录路径
  allImages.value.forEach(image => {
    const fullPath = image.relativePath
    const parts = fullPath.split('\\')

    let currentPath = ''
    for (let i = 0; i < parts.length - 1; i++) { // 排除文件名
      const part = parts[i]
      if (part) {
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}\\${part}` : part

        if (!dirMap.has(currentPath)) {
          dirMap.set(currentPath, {
            path: currentPath,
            name: part,
            children: [],
            expanded: false,
            hasImages: false
          })
        }

        // 标记包含图片的目录
        if (i === parts.length - 2) { // 最后一级目录
          dirMap.get(currentPath).hasImages = true
        }
      }
    }
  })

  // 建立父子关系
  const rootNodes = []
  dirMap.forEach((node, path) => {
    const pathParts = path.split('\\')
    if (pathParts.length === 1) {
      // 根级别目录
      rootNodes.push(node)
    } else {
      // 找到父节点
      const parentPath = pathParts.slice(0, -1).join('\\')
      const parentNode = dirMap.get(parentPath)
      if (parentNode) {
        parentNode.children.push(node)
      }
    }
  })

  // 对每个层级进行排序
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        sortNodes(node.children)
      }
    })
  }

  sortNodes(rootNodes)
  return rootNodes
})

// 过滤当前目录的图片
const filteredImages = computed(() => {
  if (!currentDirectory.value) {
    return allImages.value.filter(img => !img.relativePath.includes('\\'))
  } else {
    return allImages.value.filter(img =>
        img.relativePath.startsWith(currentDirectory.value + '\\')
    )
  }
})

// 切换目录
const switchDirectory = (directory) => {
  // 防止重复点击同一目录导致状态混乱
  if (currentDirectory.value === directory) {
    showNav.value = false
    return
  }

  currentDirectory.value = directory
  showNav.value = false // 切换目录后自动隐藏导航栏
  
  // 确保重置加载状态
  isLoadingMore.value = false
  
  // 立即加载第一批图片
  loadInitialBatch()
  
  // 强制滚动到顶部，并确保DOM更新后再滚一次，防止浏览器滚动位置恢复机制干扰
  window.scrollTo(0, 0)
  
  nextTick(() => {
    window.scrollTo(0, 0)
    setupIntersectionObserver()
  })
}

// 获取图片URL
const getImageUrl = (relativePath) => {
  const baseUrl = getBaseUrl()
  return `${baseUrl}/api/image/${encodeURIComponent(relativePath)}`
}

// 图片加载成功回调
const onImageLoad = (event) => {
  // 图片加载成功，可以在这里添加统计或其他逻辑
  // console.log('图片加载成功:', event.target.src)
}

// 图片加载失败回调
const onImageError = (event) => {
  console.error('图片加载失败:', event.target.src)
  // 可以在这里显示占位图或错误提示
  event.target.style.display = 'none'
}

watch(currentDirectory, () => {
  window.scrollTo(0, 0)
})

onMounted(() => {
  fetchAllImages()
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>

<style scoped>
.image-gallery {
  width: 100vw;
  max-width: 100vw;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-x: hidden;
  background-color: #000;
  position: relative;
}

.loading, .error, .no-images, .loading-more, .no-more {
  text-align: center;
  padding: 20px;
  font-size: 16px;
  color: #fff;
  background-color: #000;
}

.loading {
  color: #ccc;
}

.error {
  color: #ff6b6b;
}

.loading-more {
  color: #666;
}

.sentinel {
  height: 20px;
  width: 100%;
  margin: 10px 0;
}

.no-more {
  color: #999;
  font-size: 14px;
}

.no-images {
  color: #999;
}

/* 可切换导航栏样式 - 左上角悬浮面板 */
.directory-nav {
  position: fixed;
  top: 15px;
  left: 15px;
  background-color: #111;
  border: 1px solid #333;
  border-radius: 12px;
  z-index: 1000;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  max-width: 80vw;
  max-height: 70vh;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  width: 300px;
}

.directory-nav:not(.hidden) {
  transform: translateX(0);
}

.nav-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #333;
  background-color: #1a1a1a;
  border-radius: 12px 12px 0 0;
}

.nav-title {
  color: #fff;
  font-size: 16px;
  font-weight: bold;
}

.toggle-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.toggle-btn:hover {
  background-color: #333;
}

.nav-items {
  padding: 15px;
  max-height: calc(70vh - 60px);
  overflow-y: auto;
  /* 完全隐藏滚动条 */
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

/* Webkit浏览器隐藏滚动条 */
.nav-items::-webkit-scrollbar {
  display: none;
  width: 0;
  background: transparent;
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100vw;
  margin: 0;
  padding: 0;
  padding-top: 20px;
}

.image-item {
  width: 100vw;
  margin: 0;
  padding: 0;
}

.image-item img {
  width: 100vw;
  height: auto;
  display: block;
  margin: 0;
  padding: 0;
  object-fit: cover;
}

/* 显示导航栏按钮 - 左上角圆形按钮 */
.show-nav-btn {
  position: fixed;
  top: 15px;
  left: 15px;
  background-color: rgba(17, 17, 17, 0.9);
  color: #fff;
  border: 1px solid #333;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  font-size: 20px;
  cursor: pointer;
  z-index: 999;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.show-nav-btn:hover {
  background-color: rgba(17, 17, 17, 1);
  transform: scale(1.1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
}

/* 移动端优化 */
@media (max-width: 768px) {
  .directory-nav {
    top: 10px;
    left: 10px;
    width: 250px;
    max-width: 90vw;
  }

  .nav-header {
    padding: 12px;
  }

  .nav-title {
    font-size: 15px;
  }

  .nav-items {
    padding: 12px;
    max-height: calc(60vh - 50px);
  }

  .show-nav-btn {
    top: 10px;
    left: 10px;
    width: 45px;
    height: 45px;
    font-size: 18px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 480px) {
  .directory-nav {
    top: 8px;
    left: 8px;
    width: 220px;
  }

  .nav-items {
    max-height: calc(50vh - 45px);
  }

  .show-nav-btn {
    top: 8px;
    left: 8px;
    width: 40px;
    height: 40px;
    font-size: 16px;
  }
}
</style>
