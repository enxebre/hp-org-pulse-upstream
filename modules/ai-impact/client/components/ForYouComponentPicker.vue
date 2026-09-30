<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  availableComponents: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')

const filteredComponents = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return props.availableComponents
  return props.availableComponents.filter(c => c.toLowerCase().includes(q))
})

const selectedSet = computed(() => new Set(props.modelValue))

function toggle(component) {
  const current = [...props.modelValue]
  const idx = current.indexOf(component)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(component)
  }
  emit('update:modelValue', current)
}

function selectAll() {
  emit('update:modelValue', [...props.availableComponents])
}

function clearAll() {
  emit('update:modelValue', [])
}

function removeTag(component) {
  emit('update:modelValue', props.modelValue.filter(c => c !== component))
}
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-8">
      <svg class="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>

    <template v-else-if="availableComponents.length === 0">
      <p class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        No components configured
      </p>
    </template>

    <template v-else>
      <!-- Selected tags -->
      <div v-if="modelValue.length > 0" class="flex flex-wrap gap-1.5 mb-3">
        <span
          v-for="comp in modelValue"
          :key="comp"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
        >
          {{ comp }}
          <button
            @click="removeTag(comp)"
            class="hover:text-blue-600 dark:hover:text-blue-200"
            type="button"
          >
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      </div>

      <!-- Search -->
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search components..."
        class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 mb-2"
      />

      <!-- Select/Clear links -->
      <div class="flex items-center gap-3 mb-2 text-xs">
        <button @click="selectAll" type="button" class="text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
        <button @click="clearAll" type="button" class="text-blue-600 dark:text-blue-400 hover:underline">Clear All</button>
      </div>

      <!-- Checkbox list -->
      <div class="max-h-48 overflow-y-auto space-y-1 border border-gray-200 dark:border-gray-700 rounded-md p-2">
        <label
          v-for="comp in filteredComponents"
          :key="comp"
          class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
        >
          <input
            type="checkbox"
            :checked="selectedSet.has(comp)"
            @change="toggle(comp)"
            class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          {{ comp }}
        </label>
        <p v-if="filteredComponents.length === 0" class="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
          No matches
        </p>
      </div>
    </template>
  </div>
</template>
