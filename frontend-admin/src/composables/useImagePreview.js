import { computed, ref } from 'vue'

const normalizedPath = (value) => String(value || '').replace(/\\/g, '/')

export const useImagePreview = () => {
  const previewImage = ref(null)
  const previewList = ref([])
  const previewIndex = ref(-1)
  const lastPreviewWheelAt = ref(0)

  const canPreviewPrevious = computed(() => previewIndex.value > 0)
  const canPreviewNext = computed(() => previewIndex.value >= 0 && previewIndex.value < previewList.value.length - 1)
  const previewPositionLabel = computed(() => {
    if (!previewImage.value || !previewList.value.length || previewIndex.value < 0) return ''
    return `${previewIndex.value + 1} / ${previewList.value.length}`
  })

  const openPreview = (image, list = []) => {
    const normalizedImagePath = normalizedPath(image?.path)
    const normalizedList = list.map((item) => ({
      path: item.path || item.filePath,
      name: item.name
    })).filter((item) => item.path)
    const foundIndex = normalizedList.findIndex((item) => normalizedPath(item.path) === normalizedImagePath)
    previewList.value = normalizedList.length ? normalizedList : [image]
    previewIndex.value = foundIndex >= 0 ? foundIndex : 0
    previewImage.value = previewList.value[previewIndex.value] || image
  }

  const closePreview = () => {
    previewImage.value = null
    previewList.value = []
    previewIndex.value = -1
  }

  const shiftPreview = (direction) => {
    if (!previewImage.value || !previewList.value.length) return
    const nextIndex = previewIndex.value + direction
    if (nextIndex < 0 || nextIndex >= previewList.value.length) return
    previewIndex.value = nextIndex
    previewImage.value = previewList.value[nextIndex]
  }

  const handlePreviewWheel = (event) => {
    if (!previewImage.value || Math.abs(event.deltaY) < 8) return
    const now = Date.now()
    if (now - lastPreviewWheelAt.value < 260) return
    lastPreviewWheelAt.value = now
    shiftPreview(event.deltaY > 0 ? 1 : -1)
  }

  return {
    canPreviewNext,
    canPreviewPrevious,
    closePreview,
    handlePreviewWheel,
    openPreview,
    previewImage,
    previewPositionLabel,
    shiftPreview
  }
}
