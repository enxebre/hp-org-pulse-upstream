<template>
  <div class="p-6" data-testid="bug-pipeline-guide">
    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Bug Pipeline Guide</h2>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      How the automated bug pipeline works and how to onboard your component.
    </p>
    <PipelineGuide />
  </div>
</template>

<script setup>
import PipelineGuide from '../components/PipelineGuide.vue'
</script>
