<template>
  <div>
    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 px-6 pt-6">OpenShift Jira Solve Agent</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 px-6 mb-4">Track the progress and adoption of OpenShift Jira Solve Agent.</p>
    <AgentContent
      :agent-data="data"
      :loading="loading"
      :error="error"
      @retry="load"
    />
  </div>
</template>

<script setup>
import AgentContent from '../components/AgentContent.vue';
import { useAgentData } from '../composables/useAgentData.js';

const { data, loading, error, load } = useAgentData();
</script>
