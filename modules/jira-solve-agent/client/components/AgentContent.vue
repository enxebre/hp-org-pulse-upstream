<template>
  <div>
    <LoadingOverlay v-if="loading && !agentData" message="Loading agent data..." />

    <div v-else-if="error" class="p-8 text-center">
      <p class="text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
      <button class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700" @click="$emit('retry')">
        Retry
      </button>
    </div>

    <div v-else-if="!agentData || !agentData.issues || agentData.issues.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
      <p class="text-lg font-medium mb-2">No data available</p>
      <p class="text-sm">Trigger a refresh to fetch issues from Jira.</p>
    </div>

    <template v-else>
      <!-- Team selector with inline stats -->
      <div class="px-6 pt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <button
          v-for="team in teamOptions"
          :key="team.key"
          :class="[
            'relative group px-4 py-4 rounded-lg border transition-colors text-left',
            selectedTeam === team.key
              ? 'bg-primary-600 text-white border-primary-600 shadow-md'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          ]"
          :aria-describedby="reposForTeam(team.key).length ? `repos-${team.key}` : undefined"
          @click="selectedTeam = team.key"
        >
          <div class="text-sm font-semibold mb-2">{{ team.label }}</div>

          <!-- Repos this team tracks, revealed on hover/focus. -->
          <span
            v-if="reposForTeam(team.key).length"
            :id="`repos-${team.key}`"
            role="tooltip"
            class="pointer-events-none absolute left-0 top-full z-20 mt-1 w-max max-w-xs rounded-md bg-gray-900 dark:bg-gray-700 px-3 py-2 text-xs font-normal text-left text-gray-100 shadow-lg opacity-0 invisible transition-opacity group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible"
          >
            <span class="block mb-1 text-[10px] uppercase tracking-wider text-gray-400">
              {{ reposForTeam(team.key).length }} {{ reposForTeam(team.key).length === 1 ? 'repo' : 'repos' }}
            </span>
            <span v-for="repo in reposForTeam(team.key)" :key="repo" class="block whitespace-nowrap">
              {{ repo }}
            </span>
          </span>
          <div class="flex items-center gap-2.5">
            <div class="text-center">
              <div :class="['text-xl font-bold', selectedTeam === team.key ? 'text-white' : 'text-gray-900 dark:text-gray-100']">{{ teamStats(team.key).total }}</div>
              <div :class="['text-[10px] uppercase tracking-wider', selectedTeam === team.key ? 'text-white/60' : 'text-gray-400 dark:text-gray-500']">total</div>
            </div>
            <div :class="['w-px h-8', selectedTeam === team.key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700']"></div>
            <div class="text-center">
              <div :class="['text-xl font-bold', selectedTeam === team.key ? 'text-white' : 'text-amber-600 dark:text-amber-400']">{{ teamStats(team.key).inProgress }}</div>
              <div :class="['text-[10px] uppercase tracking-wider', selectedTeam === team.key ? 'text-white/60' : 'text-gray-400 dark:text-gray-500']">wip</div>
            </div>
            <div :class="['w-px h-8', selectedTeam === team.key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700']"></div>
            <div class="text-center">
              <div :class="['text-xl font-bold', selectedTeam === team.key ? 'text-white' : 'text-purple-600 dark:text-purple-400']">{{ teamStats(team.key).merged }}</div>
              <div :class="['text-[10px] uppercase tracking-wider', selectedTeam === team.key ? 'text-white/60' : 'text-gray-400 dark:text-gray-500']">merged</div>
            </div>
            <div :class="['w-px h-8', selectedTeam === team.key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700']"></div>
            <div class="text-center" :title="mergeRateTitle(teamStats(team.key))">
              <div :class="['text-xl font-bold', selectedTeam === team.key ? 'text-white' : 'text-emerald-600 dark:text-emerald-400']">{{ formatMergeRate(teamStats(team.key).mergeRate) }}</div>
              <div :class="['text-[10px] uppercase tracking-wider', selectedTeam === team.key ? 'text-white/60' : 'text-gray-400 dark:text-gray-500']">merge rate</div>
            </div>
          </div>
        </button>
      </div>

      <!-- Stat cards -->
      <div class="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ displayMetrics.totalIssues }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Total Issues</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ displayMetrics.byState.new || 0 }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">New</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ displayMetrics.byState['ready-to-solve'] || 0 }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Ready to Solve</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div class="text-2xl font-bold text-amber-600 dark:text-amber-400">{{ displayMetrics.byState['in-progress'] || 0 }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">In Progress</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div class="text-2xl font-bold text-gray-600 dark:text-gray-400">{{ displayMetrics.byState.closed || 0 }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Closed</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ displayMetrics.processedRate }}%</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Processed</div>
          <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ displayMetrics.processedCount }}/{{ displayMetrics.totalIssues }}</div>
        </div>
      </div>

      <!-- Issue table -->
      <div class="px-6 pb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <!-- Table header bar -->
          <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Issues
              <span class="text-gray-400 dark:text-gray-500 font-normal ml-1">({{ filteredIssues.length }})</span>
            </h3>
            <div class="flex items-center gap-2">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search issues..."
                class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 w-48"
              />
              <select
                v-model="prStatusFilter"
                aria-label="Filter by PR status"
                class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All PR Statuses</option>
                <option value="OPEN">Open</option>
                <option value="MERGED">Merged</option>
                <option value="CLOSED">Closed</option>
                <option value="UNKNOWN">Unknown</option>
                <option value="none">No PR</option>
              </select>
              <select
                v-model="stateFilter"
                aria-label="Filter by Jira state"
                class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Jira States</option>
                <option value="new">New</option>
                <option value="ready-to-solve">Ready to Solve</option>
                <option value="in-progress">In Progress</option>
                <option value="closed">Closed</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th
                    v-for="col in COLUMNS"
                    :key="col.key"
                    :aria-sort="ariaSort(col.key)"
                    class="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium"
                  >
                    <button
                      type="button"
                      :title="`Sort by ${col.label}`"
                      class="inline-flex items-center gap-1 font-medium hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                      :class="sortColumn === col.key ? 'text-gray-900 dark:text-gray-100' : ''"
                      @click="toggleSort(col.key)"
                    >
                      {{ col.label }}
                      <span class="text-[10px] leading-none w-2" aria-hidden="true">{{ sortIndicator(col.key) }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredIssues.length === 0">
                  <td :colspan="COLUMNS.length" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    No issues match your filters.
                  </td>
                </tr>
                <tr
                  v-for="issue in filteredIssues"
                  :key="issue.key + (issue.prUrl || '')"
                  class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td class="px-4 py-2">
                    <a
                      v-if="issue.key !== 'NO-JIRA'"
                      :href="`${jiraHost}/browse/${issue.key}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >
                      {{ issue.key }}
                    </a>
                    <span v-else class="text-gray-400 dark:text-gray-500 font-medium">{{ issue.key }}</span>
                  </td>
                  <td class="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-md truncate">
                    {{ issue.summary }}
                  </td>
                  <td class="px-4 py-2">
                    <a
                      v-if="prLink(issue)"
                      :href="prLink(issue)"
                      target="_blank"
                      rel="noopener noreferrer"
                      :class="prStatusClasses(prStatus(issue))"
                      class="hover:underline"
                    >
                      {{ prStatusLabel(prStatus(issue)) }}
                    </a>
                    <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                  </td>
                  <td class="px-4 py-2 align-top">
                    <template v-if="prList(issue).length">
                      <div v-for="pr in prList(issue)" :key="pr.url" class="whitespace-nowrap">
                        <a
                          :href="pr.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          :class="prStateTextClasses(pr.state)"
                          class="hover:underline"
                        >
                          {{ pr.label }}
                        </a>
                      </div>
                    </template>
                    <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                  </td>
                  <td class="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {{ issue.status || '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Fetched-at footer -->
          <div v-if="agentData.fetchedAt" class="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
            Last updated: {{ formatDate(agentData.fetchedAt) }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue';

const props = defineProps({
  agentData: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
});

defineEmits(['retry']);

// Team keys must match the server's TEAM_REPOS map in server/github/prs.js.
// Teams without components/projectPrefixes match only rows that carry an
// authoritative `team` (bot PR rows, attributed from the PR's repo).
const TEAMS = [
  { key: 'hypershift', label: 'HyperShift', components: ['HyperShift', 'Hosted Control Planes'] },
  { key: 'installer', label: 'Installer', components: ['Installer / openshift-installer'] },
  { key: 'trt', label: 'TRT', projectPrefix: 'TRT' },
  { key: 'wmco', label: 'Windows Containers', components: ['Windows Containers'], projectPrefixes: ['WINC'] },
  { key: 'mco', label: 'MCO', components: ['Machine Config Operator'], projectPrefixes: ['MCO'] },
  { key: 'ingress', label: 'Ingress Operator', components: ['Networking / router'], projectPrefixes: ['NE'] },
  { key: 'ota', label: 'OTA', components: ['Cluster Version Operator'], projectPrefixes: ['OTA'] },
  { key: 'kube-api', label: 'Kube & API', components: ['kube-apiserver', 'openshift-apiserver', 'apiserver-auth'], projectPrefixes: ['API', 'AUTH'] },
  { key: 'oadp', label: 'OADP & Backup', components: ['OADP'], projectPrefixes: ['OADP'] },
  { key: 'networking', label: 'Networking', components: ['Networking / ovn-kubernetes', 'Networking / cluster-network-operator'], projectPrefixes: ['SDN'] },
  { key: 'etcd', label: 'etcd', components: ['Etcd'], projectPrefixes: ['ETCD'] },
  { key: 'storage', label: 'Storage', components: ['Storage'], projectPrefixes: ['STOR'] },
  { key: 'cloud-providers', label: 'Cloud Providers', components: ['Cloud Compute'], projectPrefixes: [] },
  { key: 'cluster-lifecycle', label: 'Cluster Lifecycle', components: [], projectPrefixes: [] },
  { key: 'machine-api', label: 'Machine API', components: ['Cloud Compute / Other Provider'], projectPrefixes: [] },
  { key: 'console', label: 'Console', components: ['Management Console'], projectPrefixes: ['CONSOLE'] },
  { key: 'olm', label: 'OLM & Operators', components: ['OLM'], projectPrefixes: ['OPRUN'] },
  { key: 'support', label: 'Support & Diagnostics', components: ['Insights Operator'], projectPrefixes: ['CCXDEV'] },
  {
    key: 'edge-ecosystem',
    label: 'Edge & Ecosystem',
    // Derived from gitlab.cee.redhat.com/hybrid-platforms/org — all nested teams
    // under the Edge & Ecosystem pillar (Edge, OAP, CID, OKD, MultiArch, Metal
    // Platform, IBM System Enablement, SPLAT).
    projectPrefixes: [
      'OCPEDGE', 'USHIFT',                          // Edge
      'OAPE', 'SSCSI', 'SPIRE', 'ESO',              // Application Platform (OAP)
      'CLID',                                        // CID
      'OKD',                                         // OKD
      'MULTIARCH',                                   // Multi Architecture
      'METAL',                                       // Metal Platform
      'SPLAT', 'OPCT'                                // SPLAT
    ],
    components: [
      // Edge
      'MicroShift', 'Installer / Single Node OpenShift',
      'Two Node Fencing', 'Two Node with Arbiter',
      'Logical Volume Manager Storage',
      'Topology Transitions',
      // Application Platform (OAP)
      'cert-manager', 'external-secrets-operator', 'secrets-store-csi-driver',
      // CID
      'oc-mirror', 'mirror-gui',
      // Multi Architecture + IBM System Enablement
      'Multi-Arch', 'Multiarch Tuning Operator',
      'Multi-Arch / IBM P and Z', 'Installer / PowerVS',
      // Metal Platform
      'vcf-migration-operator'
    ]
  },
];

// Table columns, in render order. Each `key` matches a SORTERS entry, so the
// header row and the sort logic can never drift apart.
const COLUMNS = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'prStatus', label: 'PR Status' },
  { key: 'pr', label: 'PR' },
  { key: 'jiraStatus', label: 'Jira Status' }
];

const selectedTeam = ref('all');
const searchQuery = ref('');
const stateFilter = ref('all');
const prStatusFilter = ref('all');

// Table sort state. `column` matches a SORTERS key; null means "unsorted", which
// preserves the server's ordering (issues arrive newest-created first).
const sortColumn = ref(null);
const sortDir = ref('asc');

// Clicking a header cycles asc → desc → unsorted, so a user can always get back
// to the default ordering without reloading.
function toggleSort(column) {
  if (sortColumn.value !== column) {
    sortColumn.value = column;
    sortDir.value = 'asc';
  } else if (sortDir.value === 'asc') {
    sortDir.value = 'desc';
  } else {
    sortColumn.value = null;
    sortDir.value = 'asc';
  }
}

function sortIndicator(column) {
  if (sortColumn.value !== column) return '';
  return sortDir.value === 'asc' ? '▲' : '▼';
}

function ariaSort(column) {
  if (sortColumn.value !== column) return 'none';
  return sortDir.value === 'asc' ? 'ascending' : 'descending';
}

const teamOptions = computed(() => [
  { key: 'all', label: 'All Teams', components: [] },
  ...TEAMS
]);

const jiraHost = computed(() => props.agentData?.jiraHost || 'https://redhat.atlassian.net');

// team -> repo names, served by /data so the client never duplicates (and
// drifts from) the server's TEAM_REPOS mapping.
const teamRepos = computed(() => props.agentData?.teamRepos || {});

// Repos shown on a team box's hover tooltip. "All Teams" rolls up every tracked
// repo; a team with no repos wired up (or data from an older server that
// predates teamRepos) yields an empty list and renders no tooltip.
function reposForTeam(teamKey) {
  const map = teamRepos.value;
  if (teamKey === 'all') {
    return [...new Set(Object.values(map).flat())].sort();
  }
  return map[teamKey] || [];
}

function issueMatchesTeam(issue, team) {
  // Rows sourced from a chai-bot PR carry an authoritative team (derived from
  // the PR's repo). Trust it directly — their Jira key prefix/component often
  // won't map to the repo's team (e.g. an OCPBUGS-* PR in the ingress repo).
  if (issue.team) {
    return issue.team === team.key;
  }
  const prefixes = team.projectPrefixes || (team.projectPrefix ? [team.projectPrefix] : []);
  if (prefixes.some(prefix => issue.key.startsWith(prefix + '-'))) {
    return true;
  }
  if (team.components?.length && issue.components.some(c => team.components.includes(c))) {
    return true;
  }
  return false;
}

function filterByTeam(issues, teamKey) {
  if (teamKey === 'all') return issues;
  const team = TEAMS.find(t => t.key === teamKey);
  if (!team) return issues;
  return issues.filter(i => issueMatchesTeam(i, team));
}

const teamFilteredIssues = computed(() => {
  if (!props.agentData?.issues) return [];
  return filterByTeam(props.agentData.issues, selectedTeam.value);
});

// Merge rate as a percentage, or an em dash when the team has no PRs to
// measure — a team that never opened a PR has no rate, which is not the same
// as a 0% rate.
function formatMergeRate(rate) {
  return rate === null ? '—' : `${rate}%`;
}

// Spells out the ratio behind the percentage, since "merge rate" alone doesn't
// say what it is a share of.
function mergeRateTitle(stats) {
  if (!stats.withPr) return 'No pull requests yet';
  return `${stats.merged} of ${stats.withPr} rows with a PR have merged`;
}

// The team boxes read several stats each, so results are memoized per render
// pass. The cache is keyed on the issues array identity: a new payload (or any
// change to the underlying data) produces a new array and invalidates it.
const teamStatsCache = computed(() => {
  // Depend on the issues array so the cache is rebuilt whenever data changes.
  void props.agentData?.issues;
  return new Map();
});

function teamStats(teamKey) {
  const cache = teamStatsCache.value;
  if (cache.has(teamKey)) return cache.get(teamKey);
  const stats = computeTeamStats(teamKey);
  cache.set(teamKey, stats);
  return stats;
}

function computeTeamStats(teamKey) {
  if (!props.agentData?.issues) {
    return { total: 0, inProgress: 0, merged: 0, withPr: 0, mergeRate: null };
  }
  const issues = filterByTeam(props.agentData.issues, teamKey);
  let inProgress = 0;
  let merged = 0;
  let withPr = 0;
  for (const i of issues) {
    if (i.agentState === 'in-progress') inProgress++;
    // "merged" reflects the PR outcome (a real GitHub merge), independent of the
    // Jira status: any row whose rolled-up PR state is MERGED.
    const status = prStatus(i);
    if (status !== null) withPr++;
    if (status === 'MERGED') merged++;
  }
  // Merge rate is measured against rows that actually produced a PR, not the
  // team total — rows with no PR never had the chance to merge, so including
  // them would understate how much of the agent's work lands. Null (rendered
  // as an em dash) when the team has no PRs at all, rather than a false 0%.
  const mergeRate = withPr > 0 ? Math.round((merged / withPr) * 100) : null;
  return { total: issues.length, inProgress, merged, withPr, mergeRate };
}

function recomputeMetrics(issues) {
  const byState = { new: 0, 'ready-to-solve': 0, 'in-progress': 0, closed: 0, other: 0 };
  let processedCount = 0;
  for (const issue of issues) {
    byState[issue.agentState] = (byState[issue.agentState] || 0) + 1;
    if (issue.processed) processedCount++;
  }
  const totalIssues = issues.length;
  const processedRate = totalIssues > 0 ? Math.round((processedCount / totalIssues) * 100) : 0;
  return { totalIssues, byState, processedCount, processedRate };
}

const displayMetrics = computed(() => {
  if (selectedTeam.value === 'all') {
    return props.agentData?.metrics || { totalIssues: 0, byState: {}, processedCount: 0, processedRate: 0 };
  }
  return recomputeMetrics(teamFilteredIssues.value);
});

// Jira keys sort naturally: by project, then numerically, so OCPBUGS-9 comes
// before OCPBUGS-100 rather than after it lexicographically. NO-JIRA rows have
// no number and sort last within their group.
const KEY_RE = /^([A-Z][A-Z0-9]*)-(\d+)$/;

function compareKeys(a, b) {
  const ma = KEY_RE.exec(a.key || '');
  const mb = KEY_RE.exec(b.key || '');
  if (ma && mb) {
    if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
    return Number(ma[2]) - Number(mb[2]);
  }
  if (ma) return -1;
  if (mb) return 1;
  return (a.key || '').localeCompare(b.key || '');
}

// Case-insensitive text compare that always sorts blanks last, so empty cells
// don't crowd the top of an ascending sort.
function compareText(a, b) {
  const x = (a || '').trim();
  const y = (b || '').trim();
  if (!x && !y) return 0;
  if (!x) return 1;
  if (!y) return -1;
  return x.localeCompare(y, undefined, { sensitivity: 'base' });
}

// PR lifecycle order for sorting: open work first, then merged, closed, unknown,
// and rows with no PR last.
const PR_STATUS_ORDER = { OPEN: 0, MERGED: 1, CLOSED: 2, UNKNOWN: 3 };

function prStatusRank(issue) {
  const status = prStatus(issue);
  if (status === null) return 9;
  const rank = PR_STATUS_ORDER[status];
  return rank === undefined ? 8 : rank;
}

const SORTERS = {
  key: compareKeys,
  summary: (a, b) => compareText(a.summary, b.summary),
  prStatus: (a, b) => prStatusRank(a) - prStatusRank(b),
  // Rows with more PRs first, then alphabetically by the first PR's label, so
  // PRs from the same repo group together.
  pr: (a, b) => {
    const la = prList(a);
    const lb = prList(b);
    if (la.length !== lb.length) return lb.length - la.length;
    return compareText(la[0] && la[0].label, lb[0] && lb[0].label);
  },
  jiraStatus: (a, b) => compareText(a.status, b.status)
};

const filteredIssues = computed(() => {
  let issues = teamFilteredIssues.value;

  if (stateFilter.value !== 'all') {
    issues = issues.filter(i => i.agentState === stateFilter.value);
  }

  // Mirrors the PR Status column, including "none" for rows with no PR at all.
  if (prStatusFilter.value !== 'all') {
    issues = issues.filter(i => {
      const status = prStatus(i);
      if (prStatusFilter.value === 'none') return status === null;
      return status === prStatusFilter.value;
    });
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    issues = issues.filter(i =>
      i.key.toLowerCase().includes(q) ||
      i.summary.toLowerCase().includes(q) ||
      (i.assignee && i.assignee.toLowerCase().includes(q)) ||
      i.components.some(c => c.toLowerCase().includes(q))
    );
  }

  if (!sortColumn.value) return issues;

  const sorter = SORTERS[sortColumn.value];
  if (!sorter) return issues;

  const dir = sortDir.value === 'desc' ? -1 : 1;
  // Copy before sorting: `issues` may still be the array from props when no
  // filter narrowed it, and sorting in place would mutate the prop data.
  return [...issues].sort((a, b) => {
    const cmp = sorter(a, b);
    // Stable tiebreak on key so equal values keep a deterministic order rather
    // than shuffling between renders.
    return (cmp !== 0 ? cmp * dir : compareKeys(a, b));
  });
});

// PR status shown in the table. A chai-bot row carries its PR's state directly
// (prState); a Jira issue row derives a single state from its linkedPrs
// (any open → OPEN, else any merged → MERGED, else CLOSED); a plain issue has
// no PR and returns null.
function prStatus(issue) {
  if (issue.prState) return issue.prState.toUpperCase();
  const linked = issue.linkedPrs;
  if (Array.isArray(linked) && linked.length) {
    const states = linked.map(p => (p.state || 'UNKNOWN').toUpperCase());
    if (states.includes('OPEN')) return 'OPEN';
    if (states.includes('MERGED')) return 'MERGED';
    if (states.includes('CLOSED')) return 'CLOSED';
    if (states.includes('UNKNOWN')) return 'UNKNOWN';
  }
  return null;
}

// The PR to link the status badge to: the bot PR for chai-bot rows, otherwise
// the first linked PR for Jira issue rows.
function prLink(issue) {
  if (issue.prUrl) return issue.prUrl;
  const linked = issue.linkedPrs;
  if (Array.isArray(linked) && linked.length && linked[0].url) return linked[0].url;
  return null;
}

// Compact label for a single PR link: "repo#number" parsed from the PR URL
// (e.g. cluster-ingress-operator#1483), falling back to "PR ↗" when the URL
// doesn't match the expected GitHub shape.
const PR_URL_RE = /github\.com\/[^/]+\/([^/]+)\/pull\/(\d+)/;

function prLabelForUrl(url) {
  if (!url) return '';
  const m = url.match(PR_URL_RE);
  if (m) return `${m[1]}#${m[2]}`;
  return 'PR ↗';
}

// Every PR to show in the PR column for a row: the single bot PR for chai-bot
// rows, otherwise all linkedPrs for a Jira issue row. Each entry is
// { url, state, label } ready to render.
function prList(issue) {
  if (issue.prUrl) {
    return [{ url: issue.prUrl, state: (issue.prState || '').toUpperCase(), label: prLabelForUrl(issue.prUrl) }];
  }
  const linked = issue.linkedPrs;
  if (Array.isArray(linked) && linked.length) {
    return linked
      .filter(p => p && p.url)
      .map(p => ({ url: p.url, state: (p.state || 'UNKNOWN').toUpperCase(), label: prLabelForUrl(p.url) }));
  }
  return [];
}

const PR_STATUS_LABELS = { OPEN: 'Open', MERGED: 'Merged', CLOSED: 'Closed', UNKNOWN: 'Unknown' };

function prStatusLabel(state) {
  if (!state) return '—';
  return PR_STATUS_LABELS[state] || state;
}

const PR_STATUS_CLASSES = {
  OPEN: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  MERGED: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  CLOSED: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  UNKNOWN: 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
};

function prStatusClasses(state) {
  return PR_STATUS_CLASSES[state] || PR_STATUS_CLASSES.UNKNOWN;
}

// Per-PR link color in the PR column, so each PR's state is legible at a glance
// without a full badge per line (rows can carry many PRs).
const PR_STATE_TEXT_CLASSES = {
  OPEN: 'text-green-700 dark:text-green-400',
  MERGED: 'text-purple-700 dark:text-purple-400',
  CLOSED: 'text-gray-500 dark:text-gray-400',
  UNKNOWN: 'text-amber-700 dark:text-amber-400'
};

function prStateTextClasses(state) {
  return PR_STATE_TEXT_CLASSES[state] || PR_STATE_TEXT_CLASSES.UNKNOWN;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
</script>
