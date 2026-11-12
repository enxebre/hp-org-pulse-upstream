<template>
  <section data-testid="pipeline-guide" aria-labelledby="pipeline-guide-heading" class="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-5">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 id="pipeline-guide-heading" class="text-base font-semibold text-gray-900 dark:text-gray-100">How the pipeline works</h3>
      <a data-testid="pipeline-docs" :href="DOCS_URL" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
        Canonical docs<span aria-hidden="true"> ↗</span>
      </a>
    </div>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      Chai runs each stage from the source linked in its box. Open it to see exactly how the stage decides.
    </p>

    <!-- On wide screens: refine → solve → backport on the first row, with dashed drops from solve and backport into risk assessment below.
         Hovering or focusing a box lights it, its neighbors, and the edges between them, and fades the rest. -->
    <ol class="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-2 lg:gap-y-0" aria-label="Pipeline stages">
      <template v-for="stage in GUIDE" :key="stage.key">
        <li
          :data-testid="`guide-stage-${stage.key}`"
          :data-state="nodeState(stage.key)"
          class="guide-node flex flex-col rounded-lg border p-4"
          :class="stage.step
            ? 'border-primary-200 bg-primary-50/60 [--glow:theme(colors.primary.500)] dark:border-primary-800 dark:bg-primary-900/20 dark:[--glow:theme(colors.primary.400)]'
            : 'mt-2 border-dashed border-amber-400 bg-amber-50/60 [--glow:theme(colors.amber.500)] dark:border-amber-700 dark:bg-amber-900/20 dark:[--glow:theme(colors.amber.400)] lg:col-span-3 lg:col-start-3 lg:row-start-3 lg:mt-0'"
          @pointerenter="onPointerEnter($event, stage.key)"
          @pointerleave="deactivate"
          @focusin="activate(stage.key)"
          @focusout="deactivate"
        >
          <span class="flex items-center gap-2">
            <span v-if="stage.step" aria-hidden="true" class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">{{ stage.step }}</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ stage.label }}</span>
          </span>
          <div class="mt-1.5 flex-1 text-xs text-gray-600 dark:text-gray-300">
            {{ stage.description }}
            <ul v-if="stage.points" class="mt-1 list-disc space-y-0.5 pl-4">
              <li v-for="point in stage.points" :key="point" data-testid="guide-point">{{ point }}</li>
            </ul>
          </div>
          <ul class="mt-2 space-y-0.5" :aria-label="`${stage.label} sources`">
            <li v-for="source in stage.sources" :key="source.label">
              <a v-if="source.url" data-testid="guide-source" :href="source.url" target="_blank" rel="noopener noreferrer" class="font-mono text-xs font-medium text-primary-600 [overflow-wrap:anywhere] hover:underline dark:text-primary-400">
                {{ source.label }}<span aria-hidden="true"> ↗</span>
              </a>
              <span v-else data-testid="guide-source-text" class="text-xs font-medium text-gray-700 dark:text-gray-200">{{ source.label }}</span>
            </li>
          </ul>
        </li>
        <li
          v-if="stage.edge"
          aria-hidden="true"
          :data-testid="`guide-edge-${stage.edge}`"
          :data-state="edgeState(stage.edge)"
          class="guide-edge flex flex-col items-center justify-center gap-0.5 py-1 lg:px-1 lg:py-0"
          :class="edgeState(stage.edge) === 'lit' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'"
        >
          <span class="text-[10px] font-semibold uppercase tracking-wider">{{ stage.next }}</span>
          <svg viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-7 rotate-90 lg:rotate-0"><path class="guide-flow" d="M3 12h23" /><path d="M21 6l6 6-6 6" /></svg>
        </li>
      </template>
      <li
        v-for="drop in DROPS"
        :key="drop.edge"
        aria-hidden="true"
        :data-testid="`guide-edge-${drop.edge}`"
        :data-state="edgeState(drop.edge)"
        class="guide-edge hidden lg:row-start-2 lg:flex lg:justify-center"
        :class="[drop.column, edgeState(drop.edge) === 'lit' ? 'text-amber-500 dark:text-amber-400' : 'text-amber-400 dark:text-amber-600']"
      >
        <svg viewBox="0 0 4 20" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-1"><path class="guide-flow guide-flow-dashed" d="M2 0v20" /></svg>
      </li>
    </ol>

    <div data-testid="pipeline-onboarding" class="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Onboard your component</h4>
      <ol class="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
        <li>
          Make sure your Chai persona extends
          <a data-testid="onboarding-persona" :href="PERSONA_URL" target="_blank" rel="noopener noreferrer" class="font-mono text-xs text-primary-600 hover:underline dark:text-primary-400">openshift_asdlc</a>
          (<code class="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200">extends: openshift_asdlc</code>).
        </li>
        <li>
          Ask Chai, using your Jira component's name:
          <span class="mt-1.5 flex flex-wrap items-center gap-2">
            <code data-testid="onboarding-prompt" class="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800 [overflow-wrap:anywhere] dark:bg-gray-700 dark:text-gray-200">{{ ONBOARDING_PROMPT }}</code>
            <button type="button" data-testid="copy-onboarding-prompt" class="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" @click="copyPrompt">
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </span>
        </li>
      </ol>
    </div>

    <div data-testid="pipeline-repo-context" class="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Give the agents your repository's context</h4>
      <div class="mt-2 space-y-3 text-sm text-gray-600 dark:text-gray-300">
        <p>
          Use progressive disclosure: keep <code class="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200">AGENTS.md</code>
          short and link one guide per stage. Agents read <code class="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200">AGENTS.md</code>
          first and open a linked guide only when their work needs it.
        </p>
        <ul class="space-y-2" aria-label="Repository guides">
          <li v-for="file in CONTEXT_FILES" :key="file.name" :data-testid="`context-file-${file.key}`" class="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <code class="shrink-0 font-mono text-xs font-semibold text-gray-900 dark:text-gray-100 sm:w-44" :class="file.linked && 'pl-5'"><span v-if="file.linked" aria-hidden="true" class="text-gray-400 dark:text-gray-500">↳ </span>{{ file.name }}</code>
            <span class="text-xs">{{ file.description }}</span>
          </li>
        </ul>
        <pre data-testid="context-snippet" class="overflow-x-auto rounded bg-gray-100 p-3 font-mono text-xs text-gray-800 dark:bg-gray-900/60 dark:text-gray-200">{{ AGENTS_SNIPPET }}</pre>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const DOCS_URL = 'https://thoughts-e2c4a9.pages.redhat.com/self-driven-bug-backlog/self-driven-bug-backlog.html'
const PERSONA_URL = 'https://github.com/openshift-eng/ship-help-bot/blob/main/config/groups/openshift-core/personas/openshift_asdlc.yaml'
const SKILLS_URL = 'https://github.com/openshift-eng/ai-helpers/blob/main/plugins/openshift-developer/skills'
// Chai's pipeline profiles, pinned to a reviewed commit.
const PROFILES_URL = 'https://github.com/openshift-eng/ship-help-bot/blob/910ff153b5fad68550cf8868c5f7752fadd3ded2/ship_help_bot/shared/instructions/workspace/profiles'
const ONBOARDING_PROMPT = '@chai-bot please onboard "Component X" into the automated refine+solve pipeline.'

function skill(name) {
  return { label: `/openshift-developer:${name}`, url: `${SKILLS_URL}/${name}/SKILL.md` }
}

function profile(file) {
  return { label: file, url: `${PROFILES_URL}/${file}` }
}

// Stages run in order; `next` labels the arrow (`edge`) to the following stage. Risk
// assessment has no step: it labels the pull requests solve and backport open.
const GUIDE = [
  {
    key: 'refine',
    step: 1,
    label: 'Refine',
    sources: [skill('jira-refine')],
    edge: 'refine-solve',
    description: 'Triages each new OCPBUGS bug into one of:',
    // Only SOLVE gets a plan and backport targets; see the jira-refine skill.
    points: ['CLOSE', 'SOLVE, with an implementation plan and backport targets', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS'],
    next: 'SOLVE'
  },
  {
    key: 'solve',
    step: 2,
    label: 'Solve',
    sources: [profile('jira_solve_pipeline.md')],
    edge: 'solve-backport',
    description: 'Implements, reviews, and validates the fix, then opens the pull request.',
    next: 'Merged'
  },
  {
    key: 'backport',
    step: 3,
    label: 'Backport',
    sources: [profile('openshift_backport_pipeline.md'), skill('backport'), skill('cherry-pick')],
    description: 'Clones the bug for each target release and opens one cherry-pick pull request per branch.'
  },
  {
    key: 'risk',
    label: 'Risk assessment',
    sources: [
      // Still in review upstream; point at its pull request until it merges.
      { label: '/openshift-developer:pr-risk-assessment', url: 'https://github.com/openshift-eng/ai-helpers/pull/847' },
      // Named only, without a link.
      { label: 'Risk assessment guideline' }
    ],
    description: 'Labels pull requests, including the ones solve and backport open, Low, Moderate, or Critical by runtime impact and blast radius, so reviewers know how much attention each needs.'
  }
]
// Dashed drops from solve and backport into risk assessment, on wide screens.
const DROPS = [
  { edge: 'solve-risk', column: 'lg:col-start-3' },
  { edge: 'backport-risk', column: 'lg:col-start-5' }
]
const EDGES = ['refine-solve', 'solve-backport', 'solve-risk', 'backport-risk'].map(key => {
  const [from, to] = key.split('-')
  return { key, from, to }
})

// Neighborhood focus: the active box, the boxes one edge away, and those edges stay lit.
const active = ref(null)
const litEdges = computed(() => new Set(EDGES.filter(edge => edge.from === active.value || edge.to === active.value).map(edge => edge.key)))
const litNodes = computed(() => new Set(EDGES.filter(edge => litEdges.value.has(edge.key)).flatMap(edge => [edge.from, edge.to])))

function nodeState(key) {
  if (!active.value) return 'idle'
  if (key === active.value) return 'active'
  return litNodes.value.has(key) ? 'related' : 'dimmed'
}

function edgeState(key) {
  if (!active.value) return 'idle'
  return litEdges.value.has(key) ? 'lit' : 'dimmed'
}

// Clearing waits a beat so crossing the gap between two boxes does not flash the whole diagram.
let clearTimer = null
function activate(key) {
  clearTimeout(clearTimer)
  active.value = key
}

function deactivate() {
  clearTimeout(clearTimer)
  clearTimer = setTimeout(() => { active.value = null }, 80)
}

function onPointerEnter(event, key) {
  // A tap is not a hover; touch users still get the effect through focus.
  if (event.pointerType !== 'touch') activate(key)
}

const CONTEXT_FILES = [
  { key: 'agents', name: 'AGENTS.md', description: 'Entry point: what the repository ships, with links to the guides below.' },
  { key: 'refine', name: 'refine.md', linked: true, description: 'What refine should know to triage bugs in your component, such as known non-bugs and which releases take backports.' },
  { key: 'risk', name: 'risk-assessment.md', linked: true, description: 'How changes reach installations and which areas are sensitive, so risk assessment tiers pull requests correctly.' }
]
const AGENTS_SNIPPET = `## Automated Bug Pipeline guides

- [Refining bugs](refine.md)
- [Assessing pull request risk](risk-assessment.md)`

const copied = ref(false)
let copiedTimer = null
async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(ONBOARDING_PROMPT)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Clipboard access can be denied; the prompt stays visible to copy by hand.
  }
}
onBeforeUnmount(() => {
  clearTimeout(copiedTimer)
  clearTimeout(clearTimer)
})
</script>

<style scoped>
/* Each box sets its --glow color with a Tailwind class, since theme() does not reach this block. */
.guide-node { transition: opacity 200ms ease-out, transform 200ms ease-out, filter 200ms ease-out, border-color 200ms ease-out; }

.guide-edge { transition: opacity 200ms ease-out, color 200ms ease-out; }

.guide-node[data-state='dimmed'],
.guide-edge[data-state='dimmed'] { opacity: 0.25; }

.guide-node[data-state='active'] {
  border-color: var(--glow);
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--glow) 60%, transparent));
}

.guide-flow { transition: stroke-width 200ms ease-out; }
.guide-flow-dashed { stroke-dasharray: 3 3; }
.guide-edge[data-state='lit'] .guide-flow { stroke-width: 2.75; }

@media (prefers-reduced-motion: no-preference) {
  .guide-node[data-state='active'] { transform: translateY(-2px); }
  /* Lit edges carry a dash that flows toward the next stage. */
  .guide-edge[data-state='lit'] .guide-flow {
    stroke-dasharray: 4 3;
    animation: guide-flow 600ms linear infinite;
  }
}

@keyframes guide-flow {
  to { stroke-dashoffset: -7; }
}
</style>
