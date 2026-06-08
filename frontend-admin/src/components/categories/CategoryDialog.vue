<template>
  <div v-if="dialog.open" class="category-dialog-overlay" @click.self="$emit('close')">
    <section class="category-dialog">
      <header class="image-dialog-header">
        <div>
          <span class="eyebrow">Categories</span>
          <h2>{{ dialog.comic?.title }}</h2>
        </div>
        <button class="secondary-button" @click="$emit('close')">关闭</button>
      </header>
      <div class="category-dialog-body">
        <div v-if="!categories.length" class="empty-state compact">还没有分类，可以先新建一个。</div>
        <div v-else class="category-dialog-list">
          <label v-for="category in categories" :key="category.id" class="category-option">
            <input
              type="checkbox"
              :checked="dialog.selectedIds.includes(category.id)"
              @change="$emit('toggle', category.id, $event.target.checked)"
            />
            <span>{{ category.name }}</span>
          </label>
        </div>
        <div class="category-dialog-footer">
          <button class="secondary-button" @click="$emit('create')">新建分类</button>
          <button class="primary-button" @click="$emit('save')">保存分类</button>
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
  },
  categories: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close', 'create', 'save', 'toggle'])
</script>
