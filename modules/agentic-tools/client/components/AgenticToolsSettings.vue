<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage Tools</h3>
      <button
        @click="openAddForm"
        class="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white rounded-lg font-medium transition"
      >
        Add Tool
      </button>
    </div>

    <!-- Tools list -->
    <div v-if="!loading" class="space-y-3">
      <div v-if="tools.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No tools yet. Click "Add Tool" to create one.</p>
      </div>

      <div v-for="tool in tools" :key="tool.id" class="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 flex items-start gap-3">
            <!-- Icon preview -->
            <div class="flex-shrink-0 pt-1">
              <component
                :is="getIconComponent(tool.icon)"
                :size="20"
                class="text-gray-600 dark:text-gray-400"
              />
            </div>
            <!-- Title, description, url -->
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-gray-900 dark:text-gray-100">{{ tool.title }}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ tool.description }}</p>
              <p v-if="tool.url" class="text-xs text-gray-500 dark:text-gray-500 mt-2 truncate">
                {{ tool.url }}
              </p>
              <p v-else class="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                (TBD — no URL configured)
              </p>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="flex-shrink-0 flex items-center gap-3">
            <!-- Order badge -->
            <div
              class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300"
              :title="`Display order: ${tool.order ?? 0}`"
            >
              {{ tool.order ?? 0 }}
            </div>

            <!-- Edit button -->
            <button
              @click="editTool(tool)"
              class="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
            >
              ✎
            </button>

            <!-- Delete button -->
            <button
              @click="confirmDelete(tool)"
              class="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading spinner -->
    <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
      <p>Loading tools...</p>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddForm || editingTool" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {{ editingTool ? 'Edit Tool' : 'Add Tool' }}
        </h4>

        <div class="space-y-4">
          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              v-model="form.title"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Tool name"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
            <textarea
              v-model="form.description"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="What does this tool do?"
              rows="3"
            ></textarea>
          </div>

          <!-- Icon dropdown -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon *</label>
            <select
              v-model="form.icon"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select an icon</option>
              <option v-for="iconName in availableIcons" :key="iconName" :value="iconName">
                {{ iconName }}
              </option>
            </select>
          </div>

           <!-- URL -->
           <div>
             <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
               URL
               <span class="text-xs text-gray-500">(leave empty for TBD)</span>
             </label>
             <input
               v-model="form.url"
               type="url"
               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
               placeholder="https://example.com (optional)"
             />
           </div>

           <!-- Order -->
           <div>
             <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
             <input
               v-model.number="form.order"
               type="number"
               min="0"
               step="1"
               class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
               placeholder="0"
             />
             <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Tools are sorted by this value (ascending)</p>
           </div>
         </div>

        <!-- Modal buttons -->
        <div class="flex gap-3 mt-6">
          <button
            @click="closeForm"
            class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            @click="saveForm"
            :disabled="!form.title || !form.description || !form.icon"
            class="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ editingTool ? 'Update' : 'Add' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div v-if="toolToDelete" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <h4 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Tool?</h4>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong>{{ toolToDelete.title }}</strong>? This cannot be undone.
        </p>
        <div class="flex gap-3">
          <button
            @click="toolToDelete = null"
            class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            @click="performDelete"
            class="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import * as Icons from 'lucide-vue-next'
import { fetchTools, createTool, updateTool, deleteTool } from '../services/agentic-tools-api'

const tools = ref([])
const loading = ref(true)
const showAddForm = ref(false)
const editingTool = ref(null)
const toolToDelete = ref(null)

const form = reactive({
  title: '',
  description: '',
  icon: '',
  url: '',
  order: 0
})

const availableIcons = [
  'BarChart3', 'Box', 'Briefcase', 'Building2', 'Factory', 'PackageOpen',
  'ChartColumnStacked', 'FolderOpen', 'FolderTree', 'Lightbulb', 'Map',
  'Milestone', 'Target', 'UserCog', 'Users', 'UsersRound', 'User',
  'TrendingUp', 'FileText', 'Home', 'Shield', 'Settings', 'ExternalLink',
  'Network', 'Layers', 'Sparkles', 'Activity', 'Wand2', 'Kanban', 'Grid3x3',
  'LineChart', 'Brain', 'PenSquare', 'FileUp', 'Trophy', 'MessageSquare',
  'ClipboardList', 'BookOpen', 'Database', 'History', 'Hospital', 'CalendarDays',
  'LayoutDashboard', 'Rocket', 'UserCircle', 'ChartCandlestick', 'PieChart', 'GitBranch',
  'Wrench', 'Hammer', 'Drill', 'Toolbox', 'Bot', 'Zap', 'Code', 'Inbox'
]

const ICON_MAP = {
  'BarChart3': Icons.BarChart3,
  'Box': Icons.Box,
  'Briefcase': Icons.Briefcase,
  'Building2': Icons.Building2,
  'Factory': Icons.Factory,
  'PackageOpen': Icons.PackageOpen,
  'ChartColumnStacked': Icons.ChartColumnStacked,
  'FolderOpen': Icons.FolderOpen,
  'FolderTree': Icons.FolderTree,
  'Lightbulb': Icons.Lightbulb,
  'Map': Icons.Map,
  'Milestone': Icons.Milestone,
  'Target': Icons.Target,
  'UserCog': Icons.UserCog,
  'Users': Icons.Users,
  'UsersRound': Icons.UsersRound,
  'User': Icons.User,
  'TrendingUp': Icons.TrendingUp,
  'FileText': Icons.FileText,
  'Home': Icons.Home,
  'Shield': Icons.Shield,
  'Settings': Icons.Settings,
  'ExternalLink': Icons.ExternalLink,
  'Network': Icons.Network,
  'Layers': Icons.Layers,
  'Sparkles': Icons.Sparkles,
  'Activity': Icons.Activity,
  'Wand2': Icons.Wand2,
  'Kanban': Icons.Kanban,
  'Grid3x3': Icons.Grid3x3,
  'LineChart': Icons.LineChart,
  'Brain': Icons.Brain,
  'PenSquare': Icons.PenSquare,
  'FileUp': Icons.FileUp,
  'Trophy': Icons.Trophy,
  'MessageSquare': Icons.MessageSquare,
  'ClipboardList': Icons.ClipboardList,
  'BookOpen': Icons.BookOpen,
  'Database': Icons.Database,
  'History': Icons.History,
  'Hospital': Icons.Hospital,
  'CalendarDays': Icons.CalendarDays,
  'LayoutDashboard': Icons.LayoutDashboard,
  'Rocket': Icons.Rocket,
  'UserCircle': Icons.UserCircle,
  'ChartCandlestick': Icons.ChartCandlestick,
  'PieChart': Icons.PieChart,
  'GitBranch': Icons.GitBranch,
  'Wrench': Icons.Wrench,
  'Hammer': Icons.Hammer,
  'Drill': Icons.Drill,
  'Toolbox': Icons.Toolbox,
  'Bot': Icons.Bot,
  'Zap': Icons.Zap,
  'Code': Icons.Code,
  'Inbox': Icons.Inbox
}

function getIconComponent(iconName) {
  return ICON_MAP[iconName] || Icons.ExternalLink
}

async function loadTools() {
  loading.value = true
  try {
    const data = await fetchTools()
    tools.value = data
  } catch (error) {
    console.error('Failed to load tools:', error)
    tools.value = []
  } finally {
    loading.value = false
  }
}

function resetForm() {
  form.title = ''
  form.description = ''
  form.icon = ''
  form.url = ''
  form.order = 0
}

function closeForm() {
  showAddForm.value = false
  editingTool.value = null
  resetForm()
}

function openAddForm() {
  showAddForm.value = true
  editingTool.value = null
  resetForm()
  // Default new tools to append to the end (mimics server auto-assign logic)
  const maxOrder = tools.value.reduce((m, t) => Math.max(m, t.order ?? 0), -1)
  form.order = maxOrder + 1
}

function editTool(tool) {
  editingTool.value = tool
  form.title = tool.title
  form.description = tool.description
  form.icon = tool.icon
  form.url = tool.url
  form.order = tool.order ?? 0
}

async function saveForm() {
  try {
    if (editingTool.value) {
      await updateTool(editingTool.value.id, {
        title: form.title,
        description: form.description,
        icon: form.icon,
        url: form.url,
        order: Number(form.order)
      })
    } else {
      await createTool({
        title: form.title,
        description: form.description,
        icon: form.icon,
        url: form.url,
        order: Number(form.order)
      })
    }
    await loadTools()
    closeForm()
  } catch (error) {
    console.error('Failed to save tool:', error)
  }
}

function confirmDelete(tool) {
  toolToDelete.value = tool
}

async function performDelete() {
  if (!toolToDelete.value) return
  try {
    await deleteTool(toolToDelete.value.id)
    await loadTools()
    toolToDelete.value = null
  } catch (error) {
    console.error('Failed to delete tool:', error)
  }
}



onMounted(loadTools)
</script>
