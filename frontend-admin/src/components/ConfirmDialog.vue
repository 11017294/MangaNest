<template>
  <div v-if="dialog.open" class="confirm-dialog-overlay" @click.self="$emit('cancel')">
    <section class="confirm-dialog">
      <header class="image-dialog-header">
        <div>
          <span class="eyebrow">Confirm</span>
          <h2>{{ dialog.title }}</h2>
        </div>
        <button class="secondary-button" :disabled="dialog.submitting" @click="$emit('cancel')">关闭</button>
      </header>
      <div class="confirm-dialog-body">
        <p>{{ dialog.message }}</p>
        <small v-if="dialog.detail">{{ dialog.detail }}</small>
        <div class="confirm-dialog-footer">
          <button class="secondary-button" :disabled="dialog.submitting" @click="$emit('cancel')">取消</button>
          <button
            class="primary-button"
            :class="{ 'danger-confirm': dialog.danger }"
            :disabled="dialog.submitting"
            @click="$emit('confirm')"
          >
            {{ dialog.submitting ? '处理中...' : dialog.confirmText }}
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

defineEmits(['cancel', 'confirm'])
</script>
