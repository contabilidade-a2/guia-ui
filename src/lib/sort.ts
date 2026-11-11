import type { SortState } from '../api/types'

/** Each click on a column: ascending, then descending, then back to the list's default order. */
export function nextSort<F extends string>(current: SortState<F> | null, field: F): SortState<F> | null {
  if (current?.field !== field) return { field, ascending: true }
  return current.ascending ? { field, ascending: false } : null
}
