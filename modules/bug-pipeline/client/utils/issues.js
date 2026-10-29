// Mirrors bug-refinement's disposition rules so both views count bugs the same way; modules cannot import each other.
export const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
// Backport clones are recorded on the original issue as jlp-<branch>:<clone key> labels, as in bug-refinement's server.
export const BACKPORT_LABEL = /^jlp-([^:]+):([A-Z][A-Z0-9]+-\d+)$/

export const DISPOSITION_COUNTERS = [
  { key: 'SOLVE', label: 'Solve', color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'CLOSE', label: 'Close', color: 'text-slate-700 dark:text-slate-200' },
  { key: 'NEED_HUMAN_ANALYSIS', label: 'Need human analysis', color: 'text-purple-600 dark:text-purple-400' },
  { key: 'NEEDS_INFO', label: 'Needs info', color: 'text-amber-600 dark:text-amber-400' }
]

export function componentsForIssue(issue) {
  return [...new Set((issue.components || []).filter(component => typeof component === 'string' && component.trim()))].sort(collator.compare)
}

export function isJiraClosure(issue) {
  return !issue.disposition && !issue.dispositionCommentId && !issue.dispositionAt && issue.status?.toLowerCase() === 'closed'
}

export function dispositionValue(issue) {
  return isJiraClosure(issue) ? 'CLOSE' : issue.disposition
}

export function dispositionLabel(issue) {
  return isJiraClosure(issue) ? 'CLOSE (Jira)' : issue.disposition || 'Unknown'
}

export function dispositionTitle(issue) {
  if (isJiraClosure(issue)) return 'Closed in Jira; no saved refinement assessment is available in this snapshot. Closure does not confirm a verified fix.'
  return issue.disposition ? `Saved assessment${issue.dispositionAt ? `: ${formatDate(issue.dispositionAt)}` : ''}` : 'No recognized saved assessment is visible in Jira comments'
}

export function dispositionClasses(disposition) {
  return {
    SOLVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    CLOSE: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    DEFER: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    NEEDS_INFO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    NEED_HUMAN_ANALYSIS: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
  }[disposition] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}
