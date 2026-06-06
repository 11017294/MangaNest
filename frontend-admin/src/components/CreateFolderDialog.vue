<template>
  <div v-if="dialog.open" class="category-dialog-overlay" @click.self="$emit('close')">
    <section class="category-dialog create-category-dialog">
      <header class="image-dialog-header">
        <div>
          <span class="eyebrow">New Folder</span>
          <h2>新增文件夹</h2>
        </div>
        <button class="secondary-button" @click="$emit('close')">关闭</button>
      </header>
      <form class="create-category-form" @submit.prevent="$emit('save')">
        <label>
          <span>文件夹名称</span>
          <input
            :value="dialog.name"
            autofocus
            placeholder="输入文件夹名称"
            @input="$emit('update:name', $event.target.value)"
          />
        </label>
        <p v-if="dialog.error" class="form-error">{{ dialog.error }}</p>
        <div class="category-dialog-footer">
          <button class="secondary-button" type="button" @click="$emit('close')">取消</button>
          <button class="primary-button" type="submit" :disabled="dialog.submitting">
            {{ dialog.submitting ? '创建中...' : '创建文件夹' }}
          </button>
        </div>
      </form>
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

defineEmits(['close', 'save', 'update:name'])
</script>
