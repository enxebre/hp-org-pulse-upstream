<template>
  <section class="mb-8 rounded-2xl border border-primary-200 dark:border-primary-800 bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-primary-950/40 dark:via-gray-900 dark:to-blue-950/30 p-6 sm:p-8">
    <p class="text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-3">What is Org Pulse?</p>
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 max-w-3xl">
        Hybrid Platforms’ agentic evolution
    </h1>
    <p class="mt-3 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-300">
        Org Pulse brings delivery signals, engineering data, and agentic initiatives together to tell the story of how Hybrid Platforms is evolving.
    </p>
  </section>

  <section data-testid="strategic-initiatives" class="max-w-[100rem] mx-auto">
    <h2 class="px-1 mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
      Strategic Initiatives
    </h2>
    <ToolsContent />
  </section>
</template>

<script setup>
import ToolsContent from '../views/ToolsContent.vue'
</script>
