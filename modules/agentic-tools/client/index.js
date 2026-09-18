import { defineAsyncComponent } from 'vue'

export const routes = {
  tools: defineAsyncComponent(() => import('./views/ToolsView.vue'))
}
