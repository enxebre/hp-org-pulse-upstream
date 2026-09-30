<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import ForYouComponentPicker from './ForYouComponentPicker.vue'

const props = defineProps({
  mode: { type: String, required: true },
  manualComponents: { type: Array, default: () => [] },
  availableComponents: { type: Array, default: () => [] },
  componentsLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['update', 'close'])

const localMode = ref(props.mode)
const localComponents = ref([...props.manualComponents])
const popoverRef = ref(null)

watch(() => props.mode, (val) => { localMode.value = val })
watch(() => props.manualComponents, (val) => { localComponents.value = [...val] })

function handleApply() {
  emit('update', localMode.value, localComponents.value)
}

function handleResetToAuto() {
  localMode.value = 'auto'
  localComponents.value = []
  emit('update', 'auto', [])
}

function handleClickOutside(e) {
  if (popoverRef.value && !popoverRef.value.contains(e.target)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div ref="popoverRef" class="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-40 p-4">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Component Selection</h3>

    <!-- Mode toggle -->
    <div class="flex items-center gap-4 mb-4">
      <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
        <input
          type="radio"
          v-model="localMode"
          value="auto"
          class="text-blue-600 focus:ring-blue-500"
        />
        Auto
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
        <input
          type="radio"
          v-model="localMode"
          value="manual"
          class="text-blue-600 focus:ring-blue-500"
        />
        Manual
      </label>
    </div>

    <!-- Component picker (manual mode only) -->
    <div v-if="localMode === 'manual'" class="mb-4">
      <ForYouComponentPicker
        :availableComponents="availableComponents"
        v-model="localComponents"
        :loading="componentsLoading"
      />
    </div>

    <!-- Actions -->
    <div class="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
      <button
        v-if="localMode === 'manual'"
        @click="handleResetToAuto"
        type="button"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        Reset to Auto
      </button>
      <span v-else />
      <button
        @click="handleApply"
        type="button"
        class="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
      >
        Apply
      </button>
    </div>
  </div>
</template>
