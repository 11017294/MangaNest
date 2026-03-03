
<template>
  <transition-group name="message-fade" tag="div" class="message-container">
    <div 
        v-for="msg in messages" 
        :key="msg.id" 
        class="message-item"
        :class="msg.type"
    >
      <span class="message-icon">{{ getIcon(msg.type) }}</span>
      <span class="message-content">{{ msg.content }}</span>
    </div>
  </transition-group>
</template>

<script setup>
import { ref } from 'vue'

const messages = ref([])
let seed = 0

const getIcon = (type) => {
    switch(type) {
        case 'success': return '✅'
        case 'error': return '❌'
        case 'warning': return '⚠️'
        default: return 'ℹ️'
    }
}

const add = (content, type = 'info', duration = 3000) => {
    const id = seed++
    const msg = { id, content, type }
    messages.value.push(msg)
    
    if (duration > 0) {
        setTimeout(() => {
            remove(id)
        }, duration)
    }
}

const remove = (id) => {
    const index = messages.value.findIndex(m => m.id === id)
    if (index !== -1) {
        messages.value.splice(index, 1)
    }
}

// Expose method to parent or global
defineExpose({ add })
</script>

<style scoped>
.message-container {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none; /* Allow clicks to pass through */
}

.message-item {
    background: #fff;
    color: #333;
    padding: 10px 16px;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 200px;
    pointer-events: auto;
    font-size: 14px;
    border-left: 4px solid #909399;
}

.message-item.success {
    background: #f0f9eb;
    color: #67c23a;
    border-left-color: #67c23a;
}
.message-item.error {
    background: #fef0f0;
    color: #f56c6c;
    border-left-color: #f56c6c;
}
.message-item.warning {
    background: #fdf6ec;
    color: #e6a23c;
    border-left-color: #e6a23c;
}

.message-fade-enter-active,
.message-fade-leave-active {
    transition: all 0.3s ease;
}
.message-fade-enter-from,
.message-fade-leave-to {
    opacity: 0;
    transform: translateY(-20px);
}
</style>
