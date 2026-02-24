<template>
  <div class="directory-tree">
    <div
        v-for="node in treeData"
        :key="node.path"
        class="tree-node"
    >
      <!-- 目录项 -->
      <div
          class="tree-item"
          :class="{
          'has-children': node.children && node.children.length > 0,
          'expanded': isExpanded(node.path),
          'active': currentDirectory === node.path
        }"
          @click="handleNodeClick(node)"
      >
        <!-- 折叠/展开图标 -->
        <span
            v-if="node.children && node.children.length > 0"
            class="expand-icon"
            @click.stop="toggleNode(node.path)"
        >
          {{ isExpanded(node.path) ? '▼' : '▶' }}
        </span>

        <!-- 目录名称 -->
        <span class="directory-name">{{ getNodeDisplayName(node.name) }}</span>

        <!-- 子项计数 -->
        <span
            v-if="node.children && node.children.length > 0"
            class="child-count"
        >
          ({{ node.children.length }})
        </span>
      </div>

      <!-- 子节点 -->
      <div
          v-show="isExpanded(node.path) && node.children && node.children.length > 0"
          class="children-container"
      >
        <div class="children-wrapper">
          <DirectoryTree
              :tree-data="node.children"
              :current-directory="currentDirectory"
              :level="level + 1"
              :expanded-states="expandedStates"
              @node-click="handleChildNodeClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  treeData: {
    type: Array,
    required: true
  },
  currentDirectory: {
    type: String,
    default: ''
  },
  level: {
    type: Number,
    default: 0
  },
  expandedStates: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['node-click'])

// 处理子节点点击事件
const handleChildNodeClick = (path) => {
  emit('node-click', path)
}

// 切换节点展开/收起状态
const toggleNode = (nodePath) => {
  props.expandedStates[nodePath] = !props.expandedStates[nodePath]
}

// 检查节点是否展开
const isExpanded = (nodePath) => {
  return !!props.expandedStates[nodePath]
}

// 处理节点点击
const handleNodeClick = (node) => {
  // 如果是叶子节点或者点击的是目录本身，则触发选择
  if (!node.children || node.children.length === 0 || node.path === props.currentDirectory) {
    emit('node-click', node.path)
  } else {
    // 如果有子节点且未选中，则切换展开状态
    toggleNode(node.path)
  }
}

// 获取显示名称（处理根目录情况）
const getNodeDisplayName = (name) => {
  return name || '根目录'
}
</script>

<style scoped>
.directory-tree {
  width: 100%;
}

.tree-node {
  width: 100%;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
  color: #ddd;
  font-size: 14px;
  position: relative;
  user-select: none;
}

.tree-item:hover {
  background-color: #2a2a2a;
  color: #fff;
}

.tree-item.active {
  background-color: #007acc;
  color: white;
}

.tree-item.has-children {
  font-weight: 500;
}

.expand-icon {
  margin-right: 8px;
  font-size: 12px;
  color: #888;
  transition: transform 0.2s ease;
  min-width: 12px;
  display: inline-block;
  cursor: pointer;
}

.tree-item.expanded .expand-icon {
  transform: rotate(0deg);
}

.tree-item:not(.expanded) .expand-icon {
  transform: rotate(-90deg);
}

.directory-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.child-count {
  font-size: 12px;
  color: #888;
  margin-left: 8px;
}

.children-container {
  overflow: hidden;
  transition: all 0.3s ease;
}

.children-wrapper {
  padding-left: 20px;
  border-left: 1px solid #333;
  margin-left: 10px;
}

/* 不同层级的样式调整 */
.children-wrapper .children-wrapper {
  padding-left: 15px;
  margin-left: 8px;
}

.children-wrapper .children-wrapper .children-wrapper {
  padding-left: 12px;
  margin-left: 6px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .tree-item {
    padding: 8px 10px;
    font-size: 13px;
  }

  .children-wrapper {
    padding-left: 15px;
    margin-left: 8px;
  }

  .directory-name {
    font-size: 13px;
  }

  .child-count {
    font-size: 11px;
  }
}
</style>
