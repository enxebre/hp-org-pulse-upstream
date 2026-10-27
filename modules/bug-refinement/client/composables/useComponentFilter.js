import { computed, ref, watch } from 'vue'
import { collator, componentsForIssue } from '../utils/issues.js'

export function useComponentFilter(issues) {
  const selectedTeam = ref('all')
  const teamOptions = computed(() => {
    const components = [...new Set(issues.value.flatMap(componentsForIssue))].sort(collator.compare)
    return [
      { key: 'all', label: 'All Teams' },
      ...components.map(component => ({ key: `component-${encodeURIComponent(component)}`, label: component, component })),
      ...(issues.value.some(issue => componentsForIssue(issue).length === 0) ? [{ key: 'none', label: 'No component' }] : [])
    ]
  })
  watch(teamOptions, options => {
    if (!options.some(option => option.key === selectedTeam.value)) selectedTeam.value = 'all'
  })

  function issuesForTeam(teamKey) {
    if (teamKey === 'all') return issues.value
    if (teamKey === 'none') return issues.value.filter(issue => componentsForIssue(issue).length === 0)
    const component = teamOptions.value.find(option => option.key === teamKey)?.component
    return issues.value.filter(issue => componentsForIssue(issue).includes(component))
  }

  return { selectedTeam, teamOptions, issuesForTeam }
}
