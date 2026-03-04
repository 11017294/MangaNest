
<template>
  <draggable 
    :list="list" 
    :group="{ name: 'menu', put: true }"
    item-key="id"
    class="menu-list"
    handle=".drag-handle"
    :animation="200"
    ghost-class="ghost-item"
    @change="onLocalChange"
  >
    <template #item="{ element }">
      <div class="menu-item-wrapper">
        <div 
            class="menu-item" 
            :class="{ active: currentId === element.id }" 
            :title="element.name + (element.path ? ` (${element.path})` : '')"
            @click.stop="$emit('select', element)"
        >
            <!-- Indent / Expand Toggle -->
             <span 
                class="expand-toggle" 
                @click.stop="toggleExpand(element.id)"
                :style="{ visibility: (element.children && element.children.length) ? 'visible' : 'hidden' }"
             >
                {{ isExpanded(element.id) ? '▼' : '▶' }}
             </span>

            <span class="drag-handle">::</span>
            <span class="menu-name">{{ element.name }}</span>
            <div class="actions">
                <button title="编辑" @click.stop="$emit('edit', element)">✎</button>
                <button title="删除" @click.stop="$emit('delete', element)">×</button>
            </div>
        </div>
        
        <div class="menu-children" v-show="isExpanded(element.id)">
            <AdminMenuTree 
                v-if="element.children && element.children.length" 
                :list="element.children" 
                :current-id="currentId"
                :parent-id="element.id"
                :expanded-state="expandedState"
                @select="$emit('select', $event)"
                @edit="$emit('edit', $event)"
                @delete="$emit('delete', $event)"
                @change="onRecursiveChange" 
            />
             <!-- Empty drop zone for folders with no children so we can drop into them -->
             <draggable
                v-if="(!element.children || element.children.length === 0)"
                :list="element.children || []"
                :group="{ name: 'menu', put: true }"
                item-key="id"
                class="empty-drop-zone"
                ghost-class="ghost-item"
                @change="(e) => onLocalEmptyChange(e, element.id)"
             >
                <template #item="{ element: child }"><div></div></template>
             </draggable>
        </div>
      </div>
    </template>
  </draggable>
</template>

<script>
export default {
  name: 'AdminMenuTree'
}
</script>

<script setup>
import { ref } from 'vue'
import draggable from 'vuedraggable'

const props = defineProps({
  list: {
    type: Array,
    required: true
  },
  currentId: {
    type: [Number, String],
    default: null
  },
  parentId: {
    type: [Number, String],
    default: null
  },
  expandedState: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['select', 'edit', 'delete', 'change'])

const isExpanded = (id) => {
    return !!props.expandedState[id]
}

const toggleExpand = (id) => {
    props.expandedState[id] = !isExpanded(id)
}

// Change from this level's list
const onLocalChange = (evt) => {
  emit('change', evt, props.parentId)
}

// Change from empty drop zone
const onLocalEmptyChange = (evt, pid) => {
  emit('change', evt, pid)
}

// Change bubbling up from children
const onRecursiveChange = (evt, pid) => {
  emit('change', evt, pid)
}
</script>

<style scoped>
.menu-list {
  /* Minimal padding for hierarchy */
  padding-left: 16px; 
}
/* Root list shouldn't double indent if controlled by parent, but here we handle it in recursive calls */

.menu-item-wrapper {
    margin-bottom: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #ccc;
  transition: all 0.2s ease;
  height: 36px;
}

.menu-item:hover {
    background: #2a2d2e;
    color: #fff;
}

.menu-item.active {
    background: #37373d;
    color: #fff;
    font-weight: 500;
    box-shadow: inset 3px 0 0 #007acc; /* VS Code style active indicator */
}

.expand-toggle {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 4px;
    font-size: 10px;
    color: #888;
    cursor: pointer;
    border-radius: 3px;
}
.expand-toggle:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
}

.drag-handle {
  cursor: grab;
  margin-right: 8px;
  color: #555;
  font-size: 12px;
  opacity: 0; /* Hide by default, show on hover */
  transition: opacity 0.2s;
}

.menu-item:hover .drag-handle {
    opacity: 1;
}

.menu-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 14px;
    margin-right: 8px;
}

.actions {
    display: flex;
    gap: 4px;
    opacity: 0; /* Hide actions until hover */
    transition: opacity 0.2s;
}

.menu-item:hover .actions {
    opacity: 1;
}

.actions button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: #888;
    padding: 2px 4px;
    border-radius: 3px;
}
.actions button:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
}

.empty-drop-zone {
    min-height: 5px;
    margin-left: 26px; /* Align with children */
    /* border-left: 1px dashed #333; */
}

.ghost-item {
    opacity: 0.5;
    background: #444;
    border: 1px dashed #666;
}
</style>
