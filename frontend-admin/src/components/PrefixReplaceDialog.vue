<template>
  <div v-if="dialog.open" class="category-dialog-overlay" @click.self="$emit('close')">
    <section class="category-dialog create-category-dialog">
      <header class="image-dialog-header">
        <div>
          <span class="eyebrow">Rename</span>
          <h2>批量处理前缀</h2>
        </div>
        <button class="secondary-button" @click="$emit('close')">关闭</button>
      </header>
      <form class="create-category-form" @submit.prevent="$emit('save')">
        <label>
          <span>旧前缀</span>
          <input
            :value="dialog.oldPrefix"
            autofocus
            placeholder="留空则给全部子项增加新前缀"
            @input="$emit('update:old-prefix', $event.target.value)"
          />
        </label>
        <label>
          <span>新前缀</span>
          <input
            :value="dialog.newPrefix"
            placeholder="输入替换后的前缀"
            @input="$emit('update:new-prefix', $event.target.value)"
          />
        </label>
        <small class="form-help">只处理当前目录下的文件和文件夹名称，不处理子目录内部。</small>
        <p v-if="dialog.error" class="form-error">{{ dialog.error }}</p>
        <div class="category-dialog-footer">
          <button class="secondary-button" type="button" @click="$emit('close')">取消</button>
          <button class="primary-button" type="submit" :disabled="dialog.submitting">
            {{ dialog.submitting ? '处理中...' : '执行处理' }}
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

defineEmits(['close', 'save', 'update:old-prefix', 'update:new-prefix'])
</script>
