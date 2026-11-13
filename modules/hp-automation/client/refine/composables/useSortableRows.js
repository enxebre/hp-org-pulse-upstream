import { computed, ref } from 'vue'
import { collator } from '../utils/issues.js'

// Missing values stay last in both directions, and ties fall back to the issue key.
export function useSortableRows(rows, sortValue, { column = null, direction = 'asc' } = {}) {
  const sortColumn = ref(column)
  const sortDirection = ref(direction)
  const sortedRows = computed(() => {
    if (!sortColumn.value) return rows.value
    const factor = sortDirection.value === 'asc' ? 1 : -1
    return [...rows.value].sort((left, right) => {
      const leftValue = sortValue(left, sortColumn.value)
      const rightValue = sortValue(right, sortColumn.value)
      const tieBreak = () => collator.compare(left.key || '', right.key || '')
      if (leftValue === null || rightValue === null) return Number(leftValue === null) - Number(rightValue === null) || tieBreak()
      const comparison = typeof leftValue === 'number' ? leftValue - rightValue : collator.compare(leftValue, rightValue)
      return comparison * factor || tieBreak()
    })
  })

  function toggleSort(key) {
    sortDirection.value = sortColumn.value === key && sortDirection.value === 'asc' ? 'desc' : 'asc'
    sortColumn.value = key
  }

  return { sortColumn, sortDirection, sortedRows, toggleSort }
}
