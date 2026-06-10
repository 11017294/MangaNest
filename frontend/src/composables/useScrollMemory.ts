import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import { onBeforeRouteLeave, useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'

const memory = new Map<string, number>()
const STORAGE_PREFIX = 'manganest:scroll:'

type ReadySource = Ref<boolean> | (() => boolean)
type KeySource = string | ((_route: RouteLocationNormalizedLoaded) => string)

const getScrollTop = () => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0

const readStoredPosition = (key: string) => {
  if (memory.has(key)) return memory.get(key) || 0

  try {
    const value = Number(sessionStorage.getItem(`${STORAGE_PREFIX}${key}`))
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

const writeStoredPosition = (key: string, value: number) => {
  memory.set(key, value)
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, String(value))
  } catch {}
}

export const useScrollMemory = (readySource: ReadySource, keySource?: KeySource) => {
  const route = useRoute()
  let restored = false
  let restoreFrame = 0

  const getKey = () => {
    if (typeof keySource === 'function') return keySource(route)
    return keySource || route.fullPath
  }

  const isReady = () => {
    return typeof readySource === 'function' ? readySource() : readySource.value
  }

  const savePosition = () => {
    writeStoredPosition(getKey(), Math.max(0, Math.round(getScrollTop())))
  }

  const restorePosition = async () => {
    if (restored || !isReady()) return

    const targetTop = readStoredPosition(getKey())
    if (targetTop <= 0) {
      restored = true
      return
    }

    restored = true
    await nextTick()

    let attempts = 0
    const run = () => {
      const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      window.scrollTo({ left: 0, top: Math.min(targetTop, maxTop), behavior: 'auto' })

      attempts += 1
      if (Math.abs(getScrollTop() - targetTop) <= 2 || attempts >= 30) return
      restoreFrame = window.requestAnimationFrame(run)
    }

    restoreFrame = window.requestAnimationFrame(run)
  }

  onBeforeRouteLeave(() => {
    savePosition()
  })

  onMounted(() => {
    window.addEventListener('pagehide', savePosition)
  })

  onBeforeUnmount(() => {
    savePosition()
    window.removeEventListener('pagehide', savePosition)
    if (restoreFrame) window.cancelAnimationFrame(restoreFrame)
  })

  watch(isReady, (ready) => {
    if (ready) restorePosition()
  }, { immediate: true, flush: 'post' })
}
