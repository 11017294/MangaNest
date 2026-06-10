import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Shelf from '@/views/Shelf.vue'
import ComicDetail from '@/views/ComicDetail.vue'
import Reader from '@/views/Reader.vue'
import Recent from '@/views/Recent.vue'
import Settings from '@/views/Settings.vue'
import Ranking from '@/views/Ranking.vue'
import Categories from '@/views/Categories.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/shelf', component: Shelf },
  { path: '/comic/:id', component: ComicDetail },
  { path: '/reader/:chapterId', component: Reader },
  { path: '/recent', component: Recent },
  { path: '/settings', component: Settings },
  { path: '/ranking', component: Ranking },
  { path: '/categories', component: Categories }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.fullPath === from.fullPath) return false
    return { left: 0, top: 0 }
  }
})

export default router
