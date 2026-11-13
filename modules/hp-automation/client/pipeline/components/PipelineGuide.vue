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

    <!-- Two things a team does next. Each prompt is one click away and never shown in full. -->
    <div class="mt-5 grid grid-cols-1 gap-3 border-t border-gray-200 pt-5 dark:border-gray-700 lg:grid-cols-2">
      <article data-testid="pipeline-onboarding" class="action-card relative flex flex-col overflow-hidden rounded-xl border border-primary-200/80 bg-gradient-to-br from-primary-50 via-white to-white p-4 shadow-sm dark:border-primary-800/60 dark:from-primary-900/30 dark:via-gray-800 dark:to-gray-800 sm:p-5">
        <span aria-hidden="true" class="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-400/20 blur-2xl dark:bg-primary-500/20" />
        <div class="relative flex items-center gap-3">
          <span aria-hidden="true" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md shadow-primary-500/30">
            <Rocket :size="18" />
          </span>
          <div class="min-w-0">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Onboard your component</h4>
            <p class="text-xs text-gray-600 dark:text-gray-300">New bugs get refined, and solved when possible.</p>
          </div>
        </div>
        <p data-testid="onboarding-prompt" class="relative mt-4 w-fit max-w-full rounded-2xl rounded-tl-sm bg-gray-900 px-3.5 py-2 font-mono text-xs leading-relaxed text-gray-100 shadow-sm [overflow-wrap:anywhere] dark:bg-gray-950/70"><span class="font-semibold text-violet-300">{{ CHAI_MENTION }}</span>{{ ONBOARDING_REQUEST[0] }}<mark title="Your Jira component" class="rounded bg-amber-300 px-1 text-gray-900">{{ ONBOARDING_PLACEHOLDER }}</mark>{{ ONBOARDING_REQUEST[1] }}</p>
        <div class="relative mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Persona needs
            <code class="rounded bg-white/80 px-1.5 py-0.5 font-mono text-gray-800 ring-1 ring-gray-200 dark:bg-gray-900/60 dark:text-gray-200 dark:ring-gray-700">extends: <a data-testid="onboarding-persona" :href="PERSONA_URL" target="_blank" rel="noopener noreferrer" class="text-primary-600 hover:underline dark:text-primary-400">openshift_asdlc</a></code>
          </p>
          <CopyPromptButton name="onboarding-prompt" :text="ONBOARDING_PROMPT" />
        </div>
      </article>

      <article data-testid="pipeline-customize" class="action-card relative flex flex-col overflow-hidden rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-white p-4 shadow-sm dark:border-violet-800/60 dark:from-violet-900/25 dark:via-gray-800 dark:to-gray-800 sm:p-5">
        <span aria-hidden="true" class="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-400/20 blur-2xl dark:bg-violet-500/20" />
        <div class="relative flex items-center gap-3">
          <span aria-hidden="true" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/30">
            <SlidersHorizontal :size="18" />
          </span>
          <div class="min-w-0">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Customize if you need to</h4>
            <p class="text-xs text-gray-600 dark:text-gray-300">Teach refine and risk assessment your repository's specifics.</p>
          </div>
        </div>
        <ul class="relative mt-4 space-y-1 text-xs" aria-label="Repository guides">
          <li v-for="file in CONTEXT_FILES" :key="file.name" :data-testid="`context-file-${file.key}`" class="flex flex-wrap items-baseline gap-x-2" :class="file.linked && 'pl-4'">
            <code class="font-mono font-semibold text-gray-900 dark:text-gray-100"><span v-if="file.linked" aria-hidden="true" class="text-violet-400 dark:text-violet-500">↳ </span>{{ file.name }}</code>
            <span class="text-gray-500 dark:text-gray-400">{{ file.hint }}</span>
          </li>
        </ul>
        <div class="relative mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-4">
          <p class="text-xs text-gray-500 dark:text-gray-400">For your coding agent, in your repository</p>
          <CopyPromptButton name="customize-prompt" :text="CUSTOMIZE_PROMPT" />
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { Rocket, SlidersHorizontal } from 'lucide-vue-next'
import CopyPromptButton from './CopyPromptButton.vue'

const DOCS_URL = 'https://thoughts-e2c4a9.pages.redhat.com/self-driven-bug-backlog/self-driven-bug-backlog.html'
const PERSONA_URL = 'https://github.com/openshift-eng/ship-help-bot/blob/main/config/groups/openshift-core/personas/openshift_asdlc.yaml'
const SKILLS_URL = 'https://github.com/openshift-eng/ai-helpers/blob/main/plugins/openshift-developer/skills'
// Chai's pipeline profiles, pinned to a reviewed commit.
const PROFILES_URL = 'https://github.com/openshift-eng/ship-help-bot/blob/910ff153b5fad68550cf8868c5f7752fadd3ded2/ship_help_bot/shared/instructions/workspace/profiles'
// The onboarding prompt, split so the page can highlight the part to replace.
const CHAI_MENTION = '@chai-bot'
const ONBOARDING_PLACEHOLDER = 'Component X'
const ONBOARDING_REQUEST = [' please onboard "', '" into the automated refine+solve pipeline.']
const ONBOARDING_PROMPT = `${CHAI_MENTION}${ONBOARDING_REQUEST[0]}${ONBOARDING_PLACEHOLDER}${ONBOARDING_REQUEST[1]}`

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
    points: ['CLOSE', 'SOLVE', 'NEEDS_INFO', 'NEED_HUMAN_ANALYSIS'],
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
      skill('pr-risk-assessment'),
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
  { key: 'agents', name: 'AGENTS.md', hint: 'links the guides' },
  { key: 'refine', name: 'refine.md', linked: true, hint: 'known non-bugs, backport releases' },
  { key: 'risk', name: 'risk-assessment.md', linked: true, hint: 'sensitive areas, how changes ship' }
]
// For a coding agent working in the component's repository.
const CUSTOMIZE_PROMPT = `Add guides for the automated bug pipeline to this repository. Use progressive disclosure: agents read AGENTS.md first and open a linked guide only when their work needs it.

1. Create refine.md with what an agent needs to triage bugs in this component, such as known non-bugs and expected behavior, and which releases take backports.
2. Create risk-assessment.md explaining how changes reach installations and which areas are sensitive, so pull requests get the right risk tier: Low, Moderate, or Critical.
3. Add this section to AGENTS.md, creating the file if it doesn't exist, and keep AGENTS.md short:

## Automated Bug Pipeline guides

- [Refining bugs](refine.md)
- [Assessing pull request risk](risk-assessment.md)

Base both guides on this repository's code, docs, and history. Where you can't tell, leave a TODO instead of guessing.`

onBeforeUnmount(() => clearTimeout(clearTimer))
</script>

<style scoped>
/* Action cards lift a little on hover. */
.action-card { transition: transform 200ms ease-out, box-shadow 200ms ease-out; }
.action-card:hover { box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.25); }
@media (prefers-reduced-motion: no-preference) {
  .action-card:hover { transform: translateY(-2px); }
}

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
