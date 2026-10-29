<template>
  <div :id="`decision-flow-${issue.key}`" class="space-y-3" data-testid="decision-flow">
    <p v-if="!hasTimeline" role="status" class="text-sm text-gray-600 dark:text-gray-300">
      This snapshot was fetched before decision history was recorded. Refresh Agentic Bug Refinement to load who made each decision and when.
    </p>
    <template v-else>
      <ul v-if="times.length" class="flex flex-wrap gap-2" aria-label="Time between decisions">
        <li v-for="entry in times" :key="entry.key" :data-testid="`lead-time-${entry.key}`" class="rounded-full bg-white px-3 py-1 text-xs text-gray-600 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
          {{ entry.label }} <span class="font-semibold text-gray-900 dark:text-gray-100">{{ formatDuration(entry.value) }}</span>
        </li>
      </ul>
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MermaidDiagram :chart="chart" :label="`Decision flow diagram for ${issue.key}`" class="max-h-[44rem] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800" />
        <ol class="space-y-2 text-sm" :aria-label="`Decisions for ${issue.key}`">
          <li v-for="(step, index) in steps" :key="index" data-testid="flow-step" class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <p class="flex items-center gap-2">
              <span v-if="step.kind === 'assessment'" aria-hidden="true" class="inline-block h-2 w-2 shrink-0 rounded-full" :class="TONES[OUTCOME_TONES[step.outcome]].swatch" />
              <span data-testid="flow-step-title" class="font-medium text-gray-900 dark:text-gray-100">{{ stepTitle(step) }}</span>
              <span v-if="step.detail" class="text-xs text-gray-500 dark:text-gray-400">{{ step.detail }}</span>
            </p>
            <p data-testid="flow-step-meta" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ stepMeta(step) }}</p>
            <ol v-if="step.lane" class="mt-2 space-y-2 border-l-2 border-dashed border-gray-300 pl-3 dark:border-gray-600" :aria-label="`${step.key} backport decisions`">
              <li v-for="(laneStep, laneIndex) in step.lane" :key="laneIndex" data-testid="flow-lane-step">
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ laneIndex ? stepTitle(laneStep) : `${step.key}: ${stepTitle(laneStep)}` }}</p>
                <p v-if="stepMeta(laneStep)" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ stepMeta(laneStep) }}</p>
              </li>
            </ol>
          </li>
        </ol>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MermaidDiagram from './MermaidDiagram.vue'
import { OUTCOME_TONES, TONES, buildFlow, flowChart, formatDuration, leadTimes } from '../utils/decisions.js'
import { formatDate } from '../utils/issues.js'

const props = defineProps({
  issue: { type: Object, required: true },
  issuesByKey: { type: Map, required: true }
})

const hasTimeline = computed(() => Array.isArray(props.issue.timeline))
const steps = computed(() => buildFlow(props.issue, props.issuesByKey))
const chart = computed(() => flowChart(steps.value))
const times = computed(() => leadTimes(props.issue, props.issuesByKey))

function stepTitle(step) {
  return step.count > 1 ? `${step.title} ×${step.count}` : step.title
}

function stepMeta(step) {
  return [
    step.by || (step.at && 'Unknown actor'),
    step.at && formatDate(step.at),
    step.elapsed !== null && step.elapsed !== undefined && `${formatDuration(step.elapsed)} after the previous decision`
  ].filter(Boolean).join(' · ')
}
</script>
