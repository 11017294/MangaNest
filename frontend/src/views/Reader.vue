<template>
  <main class="reader-page" :class="{ chrome: showChrome }" @click="toggleChrome">
    <header class="reader-bar top" @click.stop>
      <button class="reader-icon" @click="$router.back()">‹</button>
      <div>
        <strong>{{ chapter?.comic?.title || '漫画阅读' }}</strong>
        <span>{{ chapter?.title }}</span>
      </div>
    </header>

    <section v-if="loading" class="reader-state">正在打开章节...</section>
    <section v-else-if="error" class="reader-state error">{{ error }}</section>
    <section v-else ref="stackRef" class="page-stack">
      <div class="reader-spacer" :style="{ height: readerWindow.topSpacer + 'px' }"></div>
      <article
        v-for="page in readerWindow.visiblePages"
        :key="page.id"
        class="reader-page-slot"
        :data-index="page.virtualIndex"
        :style="{ height: page.estimatedHeight + 'px' }"
      >
        <QueuedImage
          :src="pageImageUrl(page.id)"
          :alt="page.name"
        />
      </article>
      <div class="reader-spacer" :style="{ height: readerWindow.bottomSpacer + 'px' }"></div>
    </section>

    <footer class="reader-bar bottom" @click.stop>
      <span>{{ currentPageText }}</span>
      <div class="reader-actions">
        <RouterLink
          v-if="chapter?.previousChapter"
          class="reader-pill muted"
          :to="`/reader/${chapter.previousChapter.id}`"
        >
          上一章
        </RouterLink>
        <button class="reader-pill" @click="saveCurrentProgress">保存进度</button>
        <button class="reader-pill muted" @click="setCurrentAsCover">设封面</button>
        <RouterLink
          v-if="chapter?.nextChapter"
          class="reader-pill muted"
          :to="`/reader/${chapter.nextChapter.id}`"
        >
          下一章
        </RouterLink>
      </div>
    </footer>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  fetchChapter,
  fetchChapterPages,
  fetchSettings,
  pageImageUrl,
  recordReadingEvent,
  saveProgress,
  setComicCover
} from '../services/api'
import QueuedImage from '../components/QueuedImage.vue'
import { setReaderChrome } from '../capacitor'
import { createLoadQueue } from '../utils/loadQueue'
import { buildReaderWindow } from '../utils/readerWindow'

const route = useRoute()
const chapter = ref(null)
const pages = ref([])
const loading = ref(true)
const error = ref('')
const showChrome = ref(true)
const currentPageIndex = ref(0)
const initialProgress = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(window.innerHeight)
const viewportWidth = ref(Math.min(window.innerWidth, 980))
const stackRef = ref(null)
let saveTimer = null
const readerConcurrentLoads = ref(3)
const readerPreloadPages = ref(3)
const loadQueue = createLoadQueue(readerConcurrentLoads.value)
provide('readerLoadQueue', loadQueue)

const currentPageText = computed(() => {
  if (!pages.value.length) return '0 / 0'
  return `${currentPageIndex.value + 1} / ${pages.value.length}`
})

const restoreProgress = () => {
  const progress = chapter.value?.comic?.progress
  if (!progress || progress.chapterId !== Number(route.params.chapterId)) return
  initialProgress.value = progress
  requestAnimationFrame(() => {
    window.scrollTo({ top: progress.scrollOffset || 0, behavior: 'auto' })
    scrollTop.value = window.scrollY
    currentPageIndex.value = progress.pageIndex || 0
  })
}

const readerWindow = computed(() => buildReaderWindow({
  pages: pages.value,
  scrollTop: scrollTop.value,
  viewportHeight: viewportHeight.value,
  viewportWidth: viewportWidth.value,
  overscan: viewportHeight.value * Math.max(1, readerPreloadPages.value)
}))

const toggleChrome = () => {
  showChrome.value = !showChrome.value
}

const calculateCurrentPage = () => {
  const slots = Array.from(document.querySelectorAll('.reader-page-slot'))
  const midpoint = window.scrollY + window.innerHeight / 2
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY

  slots.forEach((slot) => {
    const index = Number(slot.dataset.index || 0)
    const top = slot.offsetTop
    const center = top + slot.offsetHeight / 2
    const distance = Math.abs(center - midpoint)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })

  currentPageIndex.value = bestIndex
}

const saveCurrentProgress = async () => {
  if (!chapter.value?.comicId) return
  await saveProgress({
    comicId: chapter.value.comicId,
    chapterId: Number(route.params.chapterId),
    pageIndex: currentPageIndex.value,
    scrollOffset: Math.round(window.scrollY)
  })
}

const setCurrentAsCover = async () => {
  const currentPage = pages.value[currentPageIndex.value]
  if (!chapter.value?.comicId || !currentPage) return
  await setComicCover(chapter.value.comicId, currentPage.filePath)
}

const onScroll = () => {
  scrollTop.value = window.scrollY
  calculateCurrentPage()
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveCurrentProgress().catch(() => {})
  }, 800)
}

const onResize = () => {
  viewportHeight.value = window.innerHeight
  viewportWidth.value = stackRef.value?.clientWidth || Math.min(window.innerWidth, 980)
}

const loadChapter = async () => {
  loading.value = true
  error.value = ''
  pages.value = []
  chapter.value = null
  currentPageIndex.value = 0
  scrollTop.value = 0
  window.scrollTo({ top: 0, behavior: 'auto' })
  try {
    const chapterId = route.params.chapterId
    const [chapterData, pageData, settings] = await Promise.all([
      fetchChapter(chapterId),
      fetchChapterPages(chapterId),
      fetchSettings().catch(() => ({}))
    ])
    readerConcurrentLoads.value = Number(settings.readerConcurrentLoads || 3)
    readerPreloadPages.value = Number(settings.readerPreloadPages || 3)
    loadQueue.setConcurrency(readerConcurrentLoads.value)
    chapter.value = chapterData
    pages.value = pageData
    recordReadingEvent({
      comicId: chapterData.comicId,
      chapterId: Number(chapterId),
      pageIndex: 0
    }).catch(() => {})
    requestAnimationFrame(onResize)
    restoreProgress()
  } catch (e) {
    error.value = e.message || '章节加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  setReaderChrome(true)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  await loadChapter()
})

watch(() => route.params.chapterId, () => {
  loadChapter()
})

onUnmounted(() => {
  setReaderChrome(false)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  loadQueue.clear()
  clearTimeout(saveTimer)
  saveCurrentProgress().catch(() => {})
})
</script>
