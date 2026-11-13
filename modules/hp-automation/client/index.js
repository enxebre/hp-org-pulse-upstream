import { defineAsyncComponent } from 'vue'

// One view per sidebar entry. Go Mod Automerge is a disabled placeholder with no view yet.
export const routes = {
  guide: defineAsyncComponent(() => import('./pipeline/views/GuideView.vue')),
  pipeline: defineAsyncComponent(() => import('./pipeline/views/MainView.vue')),
  solve: defineAsyncComponent(() => import('./solve/views/MainView.vue')),
  refine: defineAsyncComponent(() => import('./refine/views/MainView.vue')),
  backport: defineAsyncComponent(() => import('./backport/views/MainView.vue')),
  risk: defineAsyncComponent(() => import('./risk/views/MainView.vue')),
  cve: defineAsyncComponent(() => import('./cve/views/MainView.vue'))
}
