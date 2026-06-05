import { onBeforeUnmount, reactive } from 'vue'

export const useDeleteConfirm = () => {
  const deleteConfirmDialog = reactive({
    open: false,
    path: '',
    name: '',
    type: 'file',
    secondsRemaining: 0,
    submitting: false,
    timerId: null
  })

  const clearDeleteConfirmTimer = () => {
    if (!deleteConfirmDialog.timerId) return
    window.clearInterval(deleteConfirmDialog.timerId)
    deleteConfirmDialog.timerId = null
  }

  const closeDeleteConfirmDialog = () => {
    if (deleteConfirmDialog.submitting) return
    clearDeleteConfirmTimer()
    deleteConfirmDialog.open = false
    deleteConfirmDialog.path = ''
    deleteConfirmDialog.name = ''
    deleteConfirmDialog.type = 'file'
    deleteConfirmDialog.secondsRemaining = 0
  }

  const openDeleteConfirmDialog = (path, name, type = 'file') => {
    clearDeleteConfirmTimer()
    deleteConfirmDialog.open = true
    deleteConfirmDialog.path = path
    deleteConfirmDialog.name = name
    deleteConfirmDialog.type = type
    deleteConfirmDialog.secondsRemaining = 3
    deleteConfirmDialog.submitting = false
    deleteConfirmDialog.timerId = window.setInterval(() => {
      deleteConfirmDialog.secondsRemaining = Math.max(0, deleteConfirmDialog.secondsRemaining - 1)
      if (deleteConfirmDialog.secondsRemaining === 0) clearDeleteConfirmTimer()
    }, 1000)
  }

  onBeforeUnmount(clearDeleteConfirmTimer)

  return {
    closeDeleteConfirmDialog,
    deleteConfirmDialog,
    openDeleteConfirmDialog
  }
}
