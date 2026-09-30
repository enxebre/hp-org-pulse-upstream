<script setup>
defineProps({
  stats: {
    type: Object,
    default: () => ({ reviseRfes: 0, reviewFeatures: 0, queuedForStrat: 0, signedOffFeatures: 0 })
  }
})
</script>

<template>
  <div class="grid gap-4 grid-cols-2 lg:grid-cols-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">RFEs Needing Revision</p>
      <span class="text-2xl font-bold text-red-600 dark:text-red-400">{{ stats.reviseRfes }}</span>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">RFEs Ready for Feature Creation</p>
      <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ stats.queuedForStrat }}</span>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">Features Needing Review</p>
      <span class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ stats.reviewFeatures }}</span>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">Features Signed Off</p>
      <span class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats.signedOffFeatures }}</span>
    </div>
  </div>
</template>
