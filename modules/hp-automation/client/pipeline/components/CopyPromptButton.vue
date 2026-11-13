<template>
  <button
    type="button"
    :data-testid="`copy-${name}`"
    :data-copied="copied"
    class="copy-prompt inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
    :class="copied
      ? 'bg-emerald-600 shadow-emerald-600/30 focus-visible:ring-emerald-500'
      : 'bg-gradient-to-r from-primary-600 to-violet-600 shadow-primary-600/30 hover:shadow-md hover:brightness-110 focus-visible:ring-primary-500'"
    @click="copy"
  >
    <component :is="copied ? Check : Copy" :size="14" :stroke-width="2.5" aria-hidden="true" class="copy-prompt-icon" />
    <span aria-live="polite">{{ copied ? 'Copied' : label }}</span>
  </button>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { Check, Copy } from 'lucide-vue-next'

const props = defineProps({
  // The button's test id is `copy-<name>`.
  name: { type: String, required: true },
  text: { type: String, required: true },
  label: { type: String, default: 'Copy prompt' }
})

// The prompt is not shown on the page, so a blocked clipboard falls back to a hidden textarea.
function copyWithTextarea(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

const copied = ref(false)
let copiedTimer = null
async function copy() {
  let ok
  try {
    await navigator.clipboard.writeText(props.text)
    ok = true
  } catch {
    ok = copyWithTextarea(props.text)
  }
  if (!ok) return
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 2000)
}
onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .copy-prompt { transition-duration: 200ms; }
  .copy-prompt:active { transform: scale(0.97); }
  .copy-prompt[data-copied='true'] .copy-prompt-icon { animation: copy-prompt-pop 300ms ease-out; }
}

@keyframes copy-prompt-pop {
  0% { transform: scale(0.4); }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
