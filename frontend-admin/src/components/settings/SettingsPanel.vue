<template>
  <section class="panel content-panel settings-panel">
    <div class="panel-title">
      <h2>系统设置</h2>
      <span>漫画库根目录与索引</span>
    </div>
    <section class="library-console settings-console">
      <div class="library-copy">
        <span class="eyebrow">Library Root</span>
        <h1>漫画库根目录</h1>
        <p>{{ libraryPath || libraryPathDraft || '还没有设置漫画库根目录' }}</p>
        <div class="library-structure-note">
          <strong>分组扫描模式</strong>
          <span>根目录第一层作为管理分组，第二层开始识别漫画；没有系列的漫画可以放入“未分组”等目录。</span>
        </div>
      </div>
      <div class="library-controls">
        <label>
          <span>本机绝对路径</span>
          <input
            :value="libraryPathDraft"
            placeholder="例如 D:\\MangaLibrary"
            @input="$emit('update:libraryPathDraft', $event.target.value)"
            @keyup.enter="$emit('save')"
          />
        </label>
        <div class="library-actions">
          <button class="primary-button" @click="$emit('save')">保存根目录</button>
          <button class="secondary-button" :disabled="scanning" @click="$emit('scan')">
            {{ scanning ? '扫描中' : '扫描并重建索引' }}
          </button>
        </div>
      </div>
    </section>
  </section>
</template>

<script setup>
defineProps({
  libraryPath: {
    type: String,
    default: ''
  },
  libraryPathDraft: {
    type: String,
    default: ''
  },
  scanning: {
    type: Boolean,
    default: false
  }
})

defineEmits(['save', 'scan', 'update:libraryPathDraft'])
</script>
