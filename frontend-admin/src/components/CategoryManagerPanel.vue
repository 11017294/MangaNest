<template>
  <section class="panel content-panel" @contextmenu.prevent="$emit('list-context', $event)">
    <div class="category-toolbar">
      <button class="primary-button" @click="$emit('create')">新增分类</button>
    </div>
    <div class="category-list">
      <article
        v-for="(category, index) in categories"
        :key="category.id"
        class="category-row"
        @contextmenu.prevent.stop="$emit('category-context', $event, category, index)"
      >
        <div class="sort-actions">
          <button :disabled="index === 0" @click="$emit('move', index, -1)">上移</button>
          <button :disabled="index === categories.length - 1" @click="$emit('move', index, 1)">下移</button>
        </div>
        <input :value="category.name" @change="$emit('rename', category, $event.target.value)" />
        <button class="danger-text" @click="$emit('remove', category)">删除</button>
      </article>
    </div>
  </section>
</template>

<script setup>
defineProps({
  categories: {
    type: Array,
    default: () => []
  }
})

defineEmits([
  'category-context',
  'create',
  'list-context',
  'move',
  'remove',
  'rename'
])
</script>
