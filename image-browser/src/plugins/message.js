import { createApp } from 'vue'
import ToastMessage from '../components/ToastMessage.vue'

let instance

const getInstance = () => {
  if (!instance) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    instance = createApp(ToastMessage).mount(container)
  }
  return instance
}

const message = (content, type = 'info', duration = 3000) => {
  getInstance().add(content, type, duration)
}

message.success = (content, duration = 3000) => message(content, 'success', duration)
message.error = (content, duration = 3000) => message(content, 'error', duration)
message.warning = (content, duration = 3000) => message(content, 'warning', duration)
message.info = (content, duration = 3000) => message(content, 'info', duration)

export default message

