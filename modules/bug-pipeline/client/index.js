import { defineAsyncComponent } from 'vue'

export const routes = {
  guide: defineAsyncComponent(() => import('./views/GuideView.vue')),
  main: defineAsyncComponent(() => import('./views/MainView.vue'))
}
