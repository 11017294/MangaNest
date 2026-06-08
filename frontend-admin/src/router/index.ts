import { createRouter, createWebHashHistory } from 'vue-router'
import AdminCategories from '@/views/AdminCategories.vue'
import AdminComics from '@/views/AdminComics.vue'
import AdminFiles from '@/views/AdminFiles.vue'
import AdminSettings from '@/views/AdminSettings.vue'

export const adminMenuItems = [
  { key: 'files', label: '文件管理', path: '/files' },
  { key: 'comics', label: '漫画管理', path: '/comics' },
  { key: 'categories', label: '分类管理', path: '/categories' },
  { key: 'settings', label: '系统设置', path: '/settings' }
]

const routes = [
  { path: '/', redirect: '/files' },
  { path: '/files', name: 'files', component: AdminFiles },
  { path: '/comics', name: 'comics', component: AdminComics },
  { path: '/categories', name: 'categories', component: AdminCategories },
  { path: '/settings', name: 'settings', component: AdminSettings }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
