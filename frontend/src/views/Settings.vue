<template>
  <main class="shell settings-page">
    <section class="section-band settings-list">
      <div class="section-title">
        <h2>阅读设置</h2>
        <span>阅读端</span>
      </div>

      <label class="setting-row">
        <span>阅读预加载页数</span>
        <input v-model.number="form.readerPreloadPages" type="number" min="1" max="8" @change="saveAll" />
      </label>

      <label class="setting-row">
        <span>图片并发加载数</span>
        <input v-model.number="form.readerConcurrentLoads" type="number" min="1" max="6" @change="saveAll" />
      </label>

      <label class="setting-row">
        <span>主题</span>
        <select v-model="form.theme" @change="saveAll">
          <option value="soft-light">柔和浅色</option>
          <option value="night">夜间</option>
        </select>
      </label>

      <div class="settings-actions">
        <p v-if="message" class="settings-message">{{ message }}</p>
      </div>
    </section>

    <AppTabBar />
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import AppTabBar from '../components/AppTabBar.vue'
import { fetchSettings, updateSetting } from '../services/api'
import { applyTheme } from '../utils/theme'

const form = reactive({
  readerPreloadPages: 3,
  readerConcurrentLoads: 3,
  theme: 'soft-light'
})

const message = ref('')

const load = async () => {
  const settings = await fetchSettings().catch(() => ({}))
  form.readerPreloadPages = Number(settings.readerPreloadPages || 3)
  form.readerConcurrentLoads = Number(settings.readerConcurrentLoads || 3)
  form.theme = settings.theme || 'soft-light'
  applyTheme(form.theme)
}

const saveAll = async () => {
  message.value = ''
  try {
    await Promise.all([
      updateSetting('readerPreloadPages', Number(form.readerPreloadPages || 3)),
      updateSetting('readerConcurrentLoads', Number(form.readerConcurrentLoads || 3)),
      updateSetting('theme', form.theme)
    ])
    applyTheme(form.theme)
    message.value = '设置已保存'
  } catch (e) {
    message.value = e.message || '保存失败'
  }
}

onMounted(load)
</script>
