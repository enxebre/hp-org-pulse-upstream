<template>
  <div data-testid="agentic-tools-content">
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p>Loading tools...</p>
    </div>

    <div
      v-else-if="tools.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <component :is="Icons.Wand2" :size="48" class="text-gray-300 dark:text-gray-600 mb-4" />
      <h4 class="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">No tools yet</h4>
      <p v-if="isAdmin" class="text-sm text-gray-400 dark:text-gray-500 max-w-md">
        Go to
        <button class="text-primary-600 hover:underline" @click="goToSettings">Settings</button>
        to add your first tool.
      </p>
      <p v-else class="text-sm text-gray-400 dark:text-gray-500 max-w-md">
        No tools have been configured yet. Check back later.
      </p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <component
        :is="tool.url ? 'a' : 'div'"
        v-for="tool in tools"
        :key="tool.id"
        :href="tool.url || undefined"
        :target="tool.url ? '_blank' : undefined"
        :rel="tool.url ? 'noopener noreferrer' : undefined"
        class="block p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm transition-all group"
        :class="tool.url ? 'hover:shadow-md hover:border-primary-400 dark:hover:border-primary-500 cursor-pointer' : ''"
      >
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 pt-1">
            <component
              :is="getIconComponent(tool.icon)"
              :size="24"
              class="text-gray-600 dark:text-gray-400 transition-colors"
              :class="tool.url ? 'group-hover:text-primary-600 dark:group-hover:text-primary-400' : ''"
            />
          </div>
          <div class="flex-1 min-w-0">
            <h4
              class="text-lg font-semibold text-gray-900 dark:text-gray-100 transition-colors"
              :class="tool.url ? 'group-hover:text-primary-600 dark:group-hover:text-primary-400' : ''"
            >
              {{ tool.title }}
            </h4>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ tool.description }}
            </p>
          </div>
          <div class="flex-shrink-0">
            <span class="inline-block px-2 py-0.5 text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full">
              {{ tool.url ? 'External' : 'TBD' }}
            </span>
          </div>
        </div>
      </component>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as Icons from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from '@shared/client/composables/useAuth'

const tools = ref([])
const loading = ref(true)
const { isAdmin } = useAuth()

// Map of icon names to lucide-vue-next components
const ICON_MAP = {
  'Wrench': Icons.Wrench,
  'Hammer': Icons.Hammer,
  'Drill': Icons.Drill,
  'Toolbox': Icons.Toolbox,
  'Bot': Icons.Bot,
  'Zap': Icons.Zap,
  'Settings': Icons.Settings,
  'BarChart3': Icons.BarChart3,
  'Database': Icons.Database,
  'Code': Icons.Code,
  'ExternalLink': Icons.ExternalLink,
  'Users': Icons.Users,
  'GitBranch': Icons.GitBranch,
  'Inbox': Icons.Inbox
}

function getIconComponent(iconName) {
  return ICON_MAP[iconName] || Icons.ExternalLink
}

function goToSettings() {
  window.location.hash = '#/settings?tab=agentic-tools'
}

onMounted(async () => {
  try {
    const data = await apiRequest('/modules/agentic-tools/tools')
    tools.value = data
  } catch (error) {
    console.error('Failed to load tools:', error)
    tools.value = []
  } finally {
    loading.value = false
  }
})
</script>
