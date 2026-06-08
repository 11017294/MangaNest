import { createApp } from 'vue'
import './style.css'
import App from '@/App.vue'
import router from '@/router'
import { setupCapacitor } from '@/capacitor'

const app = createApp(App)
app.use(router)
setupCapacitor(router)
app.mount('#app')
