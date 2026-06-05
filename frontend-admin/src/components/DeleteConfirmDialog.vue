<template>
  <div v-if="dialog.open" class="delete-confirm-overlay" @click.self="$emit('close')">
    <section class="delete-confirm-dialog">
      <header class="image-dialog-header">
        <div>
          <span class="eyebrow">Delete</span>
          <h2>确认删除{{ dialog.type === 'folder' ? '文件夹' : '文件' }}</h2>
        </div>
        <button class="secondary-button" :disabled="dialog.submitting" @click="$emit('close')">关闭</button>
      </header>
      <div class="delete-confirm-body">
        <p class="delete-warning">这个操作会直接删除磁盘上的{{ dialog.type === 'folder' ? '文件夹及其中所有内容' : '文件' }}，无法在应用内恢复。</p>
        <strong>{{ dialog.name }}</strong>
        <small>{{ dialog.path }}</small>
        <div class="delete-confirm-actions">
          <button class="secondary-button" :disabled="dialog.submitting" @click="$emit('close')">取消</button>
          <button
            class="danger-button"
            :disabled="dialog.secondsRemaining > 0 || dialog.submitting"
            @click="$emit('confirm')"
          >
            <span v-if="dialog.submitting">删除中...</span>
            <span v-else-if="dialog.secondsRemaining > 0">确认删除 {{ dialog.secondsRemaining }}s</span>
            <span v-else>确认删除</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({
  dialog: {
    type: Object,
    required: true
  }
})

defineEmits(['close', 'confirm'])
</script>
