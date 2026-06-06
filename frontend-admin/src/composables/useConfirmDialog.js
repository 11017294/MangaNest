import { reactive } from 'vue'

export const useConfirmDialog = () => {
  let resolver = null

  const confirmDialog = reactive({
    open: false,
    title: '提示',
    message: '',
    detail: '',
    confirmText: '确定',
    danger: false,
    submitting: false
  })

  const resetConfirmDialog = () => {
    confirmDialog.open = false
    confirmDialog.title = '提示'
    confirmDialog.message = ''
    confirmDialog.detail = ''
    confirmDialog.confirmText = '确定'
    confirmDialog.danger = false
    confirmDialog.submitting = false
  }

  const confirm = (options = {}) => new Promise((resolve) => {
    resolver = resolve
    confirmDialog.open = true
    confirmDialog.title = options.title || '提示'
    confirmDialog.message = options.message || ''
    confirmDialog.detail = options.detail || ''
    confirmDialog.confirmText = options.confirmText || '确定'
    confirmDialog.danger = !!options.danger
    confirmDialog.submitting = false
  })

  const cancelConfirmDialog = () => {
    if (confirmDialog.submitting) return
    resolver?.(false)
    resolver = null
    resetConfirmDialog()
  }

  const acceptConfirmDialog = () => {
    if (confirmDialog.submitting) return
    resolver?.(true)
    resolver = null
    resetConfirmDialog()
  }

  return {
    acceptConfirmDialog,
    cancelConfirmDialog,
    confirm,
    confirmDialog
  }
}
