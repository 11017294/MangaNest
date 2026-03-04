import { createRouter, createWebHistory } from 'vue-router'
import ImageGallery from '../components/ImageGallery.vue'
import Admin from '../views/Admin.vue'

const routes = [
  { path: '/', component: ImageGallery },
  { path: '/admin', component: Admin }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
