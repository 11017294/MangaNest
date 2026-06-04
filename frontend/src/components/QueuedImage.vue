<template>
  <img
    :src="resolvedSrc"
    :alt="alt"
    decoding="async"
    :class="{ loaded, failed }"
    @load="loaded = true"
    @error="failed = true"
  />
</template>

<script setup>
import { inject, onMounted, ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  }
})

const loadQueue = inject('readerLoadQueue', null)
const resolvedSrc = ref('')
const loaded = ref(false)
const failed = ref(false)
let token = 0

const scheduleLoad = async () => {
  const currentToken = ++token
  loaded.value = false
  failed.value = false
  resolvedSrc.value = ''

  const assign = () => {
    if (currentToken === token) resolvedSrc.value = props.src
  }

  if (loadQueue) {
    await loadQueue.run(assign)
  } else {
    assign()
  }
}

watch(() => props.src, scheduleLoad)
onMounted(scheduleLoad)
</script>
