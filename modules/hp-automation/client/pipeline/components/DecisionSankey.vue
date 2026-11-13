<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" data-testid="decision-sankey">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Decision flow</h3>
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Each band is a group of refined bugs moving from one decision to the next; its width is the number of bugs, and percentages are of all refined bugs.
      Hover or focus a box or band for details and the median time between decisions, and select it to list those bugs below.
      Backport boxes also count backports; a bug whose backports are at different steps shows as Some PRs posted or Partly merged.
      <template v-if="graph.reassessed">The first assessment column appears because some bugs were assessed again with a different outcome.</template>
    </p>
    <template v-if="phases.length">
      <p class="mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">Median time per phase</p>
      <ul class="mt-1 flex flex-wrap gap-2" aria-label="Median time per phase" data-testid="sankey-phases">
        <li
          v-for="phase in phases"
          :key="phase.key"
          :data-testid="`phase-time-${phase.key}`"
          class="rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:ring-gray-700"
        >
          {{ phase.label }} <span class="font-semibold text-gray-900 dark:text-gray-100">{{ formatDuration(phase.median) }}</span> <span class="text-gray-400 dark:text-gray-500">· {{ bugs(phase.timed) }}</span>
        </li>
      </ul>
    </template>
    <div ref="container" class="relative mt-4 overflow-x-auto">
      <svg :width="width" :height="HEIGHT" :viewBox="`0 0 ${width} ${HEIGHT}`" role="group" aria-label="Decision flow of refined bugs" class="block overflow-visible">
        <text
          v-for="column in layout.columns"
          :key="column.key"
          :x="column.x0"
          y="12"
          class="fill-gray-500 text-[10px] font-semibold uppercase tracking-wider dark:fill-gray-400"
        >{{ column.label }}</text>
        <g
          v-for="link in layout.links"
          :key="link.id"
          :data-testid="`sankey-link-${link.id}`"
          role="button"
          tabindex="0"
          :aria-pressed="selectedId === link.id"
          :aria-label="linkLabel(link)"
          class="cursor-pointer focus:outline-none"
          @pointerenter="hovered = { type: 'link', item: link }"
          @pointerleave="hovered = null"
          @focus="hovered = { type: 'link', item: link }"
          @blur="hovered = null"
          @click="select(link)"
          @keydown.enter.prevent="select(link)"
          @keydown.space.prevent="select(link)"
        >
          <path :d="link.path" fill="none" :class="TONES[link.tone].stroke" :stroke-width="Math.max(1, link.width)" :stroke-opacity="linkOpacity(link)" />
          <path :d="link.path" fill="none" stroke="transparent" :stroke-width="Math.max(12, link.width)" />
        </g>
        <g
          v-for="node in layout.nodes"
          :key="node.id"
          :data-testid="`sankey-node-${node.id}`"
          role="button"
          tabindex="0"
          :aria-pressed="selectedId === node.id"
          :aria-label="nodeLabel(node)"
          class="cursor-pointer focus:outline-none"
          @pointerenter="hovered = { type: 'node', item: node }"
          @pointerleave="hovered = null"
          @focus="hovered = { type: 'node', item: node }"
          @blur="hovered = null"
          @click="select(node)"
          @keydown.enter.prevent="select(node)"
          @keydown.space.prevent="select(node)"
        >
          <rect :x="node.x0 - 6" :y="node.y0 - 4" :width="node.x1 - node.x0 + 12" :height="node.y1 - node.y0 + 8" fill="transparent" />
          <rect
            :x="node.x0"
            :y="node.y0"
            :width="node.x1 - node.x0"
            :height="Math.max(1, node.y1 - node.y0)"
            rx="2"
            :class="[TONES[node.tone].fill, isFocused(node) ? 'stroke-gray-900 dark:stroke-white' : '']"
            :stroke-width="isFocused(node) ? 2 : 0"
            :fill-opacity="dimmed(node.id) ? 0.35 : 1"
          />
          <text
            :x="node.x1 + 6"
            :y="(node.y0 + node.y1) / 2"
            class="pointer-events-none fill-gray-700 stroke-white text-xs dark:fill-gray-200 dark:stroke-gray-800"
            stroke-width="3"
            paint-order="stroke"
          >
            <tspan :x="node.x1 + 6" :dy="node.backports ? '-0.85em' : '-0.25em'">{{ node.short }}</tspan>
            <tspan :x="node.x1 + 6" dy="1.2em"><tspan class="font-semibold" data-testid="sankey-node-value">{{ node.value }}</tspan> · <tspan data-testid="sankey-node-share">{{ share(node.value) }}</tspan></tspan>
            <tspan v-if="node.backports" :x="node.x1 + 6" dy="1.2em" data-testid="sankey-node-backports">{{ backportCount(node.backports.total) }}</tspan>
          </text>
        </g>
      </svg>
      <div
        v-if="tooltip"
        data-testid="sankey-tooltip"
        role="status"
        class="pointer-events-none absolute z-10 w-56 rounded-md border border-gray-200 bg-white p-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px`, transform: `translate(${tooltip.alignRight ? '-100%' : '0'}, ${tooltip.above ? 'calc(-100% - 12px)' : '12px'})` }"
      >
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {{ bugs(tooltip.value) }} <span class="font-normal text-gray-500 dark:text-gray-400">· {{ share(tooltip.value) }} of refined bugs</span>
        </p>
        <p class="mt-0.5 flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
          <span aria-hidden="true" class="inline-block h-0.5 w-3 shrink-0 rounded" :class="TONES[tooltip.tone].swatch" />{{ tooltip.title }}
        </p>
        <p v-if="tooltip.sourceShare" class="mt-1 text-gray-600 dark:text-gray-300">{{ tooltip.sourceShare }}</p>
        <p v-if="tooltip.backports" class="mt-1 text-gray-600 dark:text-gray-300">{{ backportText(tooltip.backports) }}</p>
        <p v-if="tooltip.timing" class="mt-1 text-gray-600 dark:text-gray-300">Median {{ tooltip.timing }}</p>
        <p class="mt-1 text-gray-400 dark:text-gray-500">{{ selectedId === tooltip.id ? 'Selected — select again to clear' : 'Select to list these bugs' }}</p>
      </div>
    </div>
    <details class="mt-3 text-xs text-gray-600 dark:text-gray-300" @toggle="tableOpen = $event.target.open">
      <summary class="cursor-pointer font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100">Show flows as a table</summary>
      <!-- Rendered only while open, so the page's bug table stays the only table otherwise. -->
      <table v-if="tableOpen" class="mt-2 w-full text-left" data-testid="sankey-table">
        <thead class="text-gray-500 dark:text-gray-400">
          <tr>
            <th scope="col" class="py-1 pr-3 font-medium">From</th>
            <th scope="col" class="py-1 pr-3 font-medium">To</th>
            <th scope="col" class="py-1 pr-3 text-right font-medium">Bugs</th>
            <th scope="col" class="py-1 pr-3 text-right font-medium">Of refined</th>
            <th scope="col" class="py-1 pr-3 text-right font-medium">Of From</th>
            <th scope="col" class="py-1 font-medium">Median time between decisions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="link in layout.links" :key="link.id" class="border-t border-gray-100 dark:border-gray-700/50">
            <td class="py-1 pr-3">{{ nodeTitle(link.source) }}</td>
            <td class="py-1 pr-3">{{ nodeTitle(link.target) }}</td>
            <td class="py-1 pr-3 text-right tabular-nums">{{ link.value }}</td>
            <td class="py-1 pr-3 text-right tabular-nums">{{ share(link.value) }}</td>
            <td class="py-1 pr-3 text-right tabular-nums">{{ formatShare(link.value, nodesById.get(link.source).value) }}</td>
            <td class="py-1">{{ timingText(link) || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { TONES, buildDecisionGraph, formatDuration, formatShare, layoutSankey, phaseTimes } from '../utils/decisions.js'

const props = defineProps({
  issues: { type: Array, required: true },
  tracked: { type: Boolean, default: true },
  issuesByKey: { type: Map, default: () => new Map() },
  selectedId: { type: String, default: null }
})
const emit = defineEmits(['select'])

// Two-line labels need more room between boxes than single-line ones, and each column a minimum width.
const HEIGHT = 372
// Leaves room for a three-line label on a box at the top of its column, below the column headers.
const TOP = 40
const NODE_WIDTH = 12
const NODE_PADDING = 28
// Backport boxes carry a third label line.
const BACKPORT_PADDING = 44
const MIN_COLUMN_STEP = 120
const LABEL_GUTTER = 110
const TOOLTIP_WIDTH = 224
const container = ref(null)
const containerWidth = ref(960)
const hovered = ref(null)
const tableOpen = ref(false)
const graph = computed(() => buildDecisionGraph(props.issues, { tracked: props.tracked, issuesByKey: props.issuesByKey }))
const width = computed(() => Math.max(containerWidth.value, (graph.value.columns.length - 1) * MIN_COLUMN_STEP + NODE_WIDTH + LABEL_GUTTER))
const layout = computed(() => layoutSankey(graph.value, { width: width.value, height: HEIGHT, nodeWidth: NODE_WIDTH, nodePadding: column => (column.key.startsWith('backport') ? BACKPORT_PADDING : NODE_PADDING), top: TOP, bottom: 16, right: LABEL_GUTTER }))
const phases = computed(() => phaseTimes(props.issues, props.issuesByKey))
const nodesById = computed(() => new Map(layout.value.nodes.map(node => [node.id, node])))
const columnLabels = computed(() => Object.fromEntries(layout.value.columns.map(column => [column.key, column.label])))
const selectedKeys = computed(() => {
  const selected = nodesById.value.get(props.selectedId) || layout.value.links.find(link => link.id === props.selectedId)
  return selected ? new Set(selected.keys) : null
})
const tooltip = computed(() => {
  if (!hovered.value) return null
  const { type, item } = hovered.value
  // Open below points in the top half and above points in the bottom half, so the scroll container never clips it.
  const x = type === 'node' ? item.x1 + 8 : (item.x0 + item.x1) / 2
  const y = (item.y0 + item.y1) / 2
  return {
    id: item.id,
    value: item.value,
    tone: item.tone,
    title: type === 'node' ? nodeTitle(item.id) : `${nodeTitle(item.source)} → ${nodeTitle(item.target)}`,
    timing: type === 'link' ? timingText(item) : null,
    sourceShare: type === 'link' ? sourceShareText(item) : null,
    backports: type === 'node' ? item.backports : null,
    x,
    y,
    above: y > HEIGHT / 2,
    alignRight: x > width.value - TOOLTIP_WIDTH
  }
})

let observer = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !container.value) return
  observer = new ResizeObserver(([entry]) => {
    containerWidth.value = Math.floor(entry.contentRect.width)
  })
  observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

function nodeTitle(id) {
  const node = nodesById.value.get(id)
  return node.column === 'refined' ? node.label : `${columnLabels.value[node.column]}: ${node.label}`
}

function bugs(count) {
  return `${count} ${count === 1 ? 'bug' : 'bugs'}`
}

function share(count) {
  return formatShare(count, graph.value.total)
}

function sourceShareText(link) {
  return `${formatShare(link.value, nodesById.value.get(link.source).value)} of ${nodeTitle(link.source)}`
}

function backportCount(total) {
  return `${total} ${total === 1 ? 'backport' : 'backports'}`
}

function backportText({ total, stages }) {
  return `${backportCount(total)}: ${stages.map(stage => `${stage.count} ${stage.label}`).join(', ')}`
}

function timingText(link) {
  if (!link.timing || link.timing.median === null) return null
  return `${link.timing.label}: ${formatDuration(link.timing.median)} (${link.timing.timed} of ${bugs(link.value)} timed)`
}

function nodeLabel(node) {
  const backports = node.backports ? `, ${backportText(node.backports)}` : ''
  return `${nodeTitle(node.id)}, ${bugs(node.value)}, ${share(node.value)} of refined bugs${backports}`
}

function linkLabel(link) {
  const timing = timingText(link)
  return `${nodeTitle(link.source)} to ${nodeTitle(link.target)}, ${bugs(link.value)}, ${sourceShareText(link)}${timing ? `, median ${timing}` : ''}`
}

function dimmed(id) {
  if (!selectedKeys.value) return false
  const item = nodesById.value.get(id) || layout.value.links.find(link => link.id === id)
  return !item.keys.some(key => selectedKeys.value.has(key))
}

function linkOpacity(link) {
  if (hovered.value?.item.id === link.id || props.selectedId === link.id) return 0.7
  return dimmed(link.id) ? 0.12 : 0.35
}

function isFocused(node) {
  return hovered.value?.item.id === node.id || props.selectedId === node.id
}

function select(item) {
  if (props.selectedId === item.id) {
    emit('select', null)
    return
  }
  const title = item.source ? `${nodeTitle(item.source)} → ${nodeTitle(item.target)}` : nodeTitle(item.id)
  emit('select', { id: item.id, label: title, keys: item.keys })
}
</script>
