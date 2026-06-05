import { onBeforeUnmount, ref } from 'vue'

export const useMessages = () => {
  const messages = ref([])
  let nextMessageId = 0

  const removeMessage = (id) => {
    const target = messages.value.find((item) => item.id === id)
    if (target?.timerId) window.clearTimeout(target.timerId)
    messages.value = messages.value.filter((item) => item.id !== id)
  }

  const notify = (text, type = 'success') => {
    const cleanText = String(text || '').trim()
    if (!cleanText) return
    const id = nextMessageId++
    const timerId = window.setTimeout(() => removeMessage(id), 3200)
    messages.value = [...messages.value.slice(-3), { id, type, text: cleanText, timerId }]
  }

  const notifySuccess = (text) => notify(text, 'success')
  const notifyError = (text) => notify(text, 'error')

  onBeforeUnmount(() => {
    messages.value.forEach((item) => {
      if (item.timerId) window.clearTimeout(item.timerId)
    })
  })

  return {
    messages,
    notifyError,
    notifySuccess,
    removeMessage
  }
}
