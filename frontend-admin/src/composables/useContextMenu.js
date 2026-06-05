import { reactive } from 'vue'

export const useContextMenu = ({ onError } = {}) => {
  const contextMenu = reactive({
    open: false,
    x: 0,
    y: 0,
    title: '',
    items: []
  })

  const closeContextMenu = () => {
    contextMenu.open = false
  }

  const showContextMenu = (event, title, items) => {
    const visibleItems = items.filter(Boolean)
    const estimatedHeight = 42 + visibleItems.length * 38
    contextMenu.title = title
    contextMenu.items = visibleItems
    contextMenu.x = Math.min(event.clientX, Math.max(12, window.innerWidth - 230))
    contextMenu.y = Math.min(event.clientY, Math.max(12, window.innerHeight - estimatedHeight - 12))
    contextMenu.open = true
  }

  const runContextAction = async (item) => {
    if (!item || item.disabled) return
    closeContextMenu()
    try {
      await item.action?.()
    } catch (e) {
      onError?.(e.message || '操作失败')
    }
  }

  return {
    closeContextMenu,
    contextMenu,
    runContextAction,
    showContextMenu
  }
}
