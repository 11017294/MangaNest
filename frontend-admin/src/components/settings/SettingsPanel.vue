<template>
  <section class="panel content-panel settings-panel">
    <div class="panel-title">
      <h2>系统设置</h2>
      <span>漫画库根目录与索引维护</span>
    </div>
    <section class="library-console settings-console">
      <div class="library-copy">
        <span class="eyebrow">Library Root</span>
        <h1>漫画库根目录</h1>
        <p>{{ libraryPath || libraryPathDraft || '还没有设置漫画库根目录' }}</p>
        <div class="library-structure-note">
          <strong>分组扫描模式</strong>
          <span
            >根目录第一层作为管理分组，第二层开始识别漫画；没有系列的漫画可以放入“未分组”等目录。</span
          >
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
            {{ scanning ? '扫描中...' : '扫描并同步索引' }}
          </button>
        </div>
      </div>
    </section>
    <section class="index-maintenance">
      <div class="index-maintenance-copy">
        <span class="eyebrow">Index Maintenance</span>
        <strong>索引维护</strong>
        <p>
          用于检查磁盘文件移动、删除后留下的无效漫画索引。清理只处理数据库记录，不会删除磁盘文件。
        </p>
      </div>
      <div class="index-maintenance-actions">
        <button class="secondary-button" :disabled="indexBusy" @click="$emit('inspect-index')">
          {{ indexBusy === 'inspect' ? '检查中...' : '检查索引' }}
        </button>
        <button
          class="danger-button"
          :disabled="indexBusy || !indexIssueCount"
          @click="$emit('cleanup-index')"
        >
          {{ indexBusy === 'cleanup' ? '清理中...' : '清理无效索引' }}
        </button>
      </div>
      <dl class="index-summary">
        <div>
          <dt>问题总数</dt>
          <dd>{{ indexIssueCount }}</dd>
        </div>
        <div>
          <dt>失效漫画</dt>
          <dd>{{ indexSummary?.missingComics || 0 }}</dd>
        </div>
        <div>
          <dt>失效章节</dt>
          <dd>{{ indexSummary?.invalidChapters || 0 }}</dd>
        </div>
        <div>
          <dt>失效图片</dt>
          <dd>{{ indexSummary?.invalidPages || 0 }}</dd>
        </div>
      </dl>
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
  },
  indexBusy: {
    type: [String, Boolean],
    default: ''
  },
  indexSummary: {
    type: Object,
    default: null
  },
  indexIssueCount: {
    type: Number,
    default: 0
  }
})

defineEmits(['cleanup-index', 'inspect-index', 'save', 'scan', 'update:libraryPathDraft'])
</script>
