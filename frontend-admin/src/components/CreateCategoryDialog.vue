<template>
  <div v-if="dialog.open" class="category-dialog-overlay" @click.self="$emit('close')">
    <section class="category-dialog create-category-dialog">
      <header class="image-dialog-header">
        <div>
          <span class="eyebrow">New Category</span>
          <h2>新增分类</h2>
        </div>
        <button class="secondary-button" @click="$emit('close')">关闭</button>
      </header>
      <form class="create-category-form" @submit.prevent="$emit('save')">
        <label>
          <span>分类名</span>
          <input
            :value="dialog.name"
            placeholder="分类名"
            @input="$emit('update:name', $event.target.value)"
          />
        </label>
        <label>
          <span>排序号</span>
          <input
            :value="dialog.sortOrder"
            type="number"
            min="0"
            step="1"
            placeholder="排序号"
            @input="$emit('update:sortOrder', Number($event.target.value))"
          />
        </label>
        <p v-if="dialog.error" class="form-error">{{ dialog.error }}</p>
        <div class="category-dialog-footer">
          <button class="secondary-button" type="button" @click="$emit('close')">取消</button>
          <button class="primary-button" type="submit">创建分类</button>
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

defineEmits(['close', 'save', 'update:name', 'update:sortOrder'])
</script>
