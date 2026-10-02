<script setup>
const emit = defineEmits(['switchToManual'])
</script>

<template>
  <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
    <h3 class="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">No components found</h3>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      We couldn't find components assigned to you in the roster.
    </p>
    <button
      @click="emit('switchToManual')"
      type="button"
      class="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
    >
      Choose Components Manually
    </button>
  </div>
</template>
