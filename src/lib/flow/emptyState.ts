import type { FlowSegment } from '@/lib/store/useExpenseFilterStore'

export type FlowEmptyState = 'none' | 'setup' | 'emptyMonth' | 'emptySegment' | 'noMatch'

export interface FlowEmptyInput {
  /** Unfiltered rows in the range, every segment. */
  allCount: number
  /** Rows after the segment and filters. */
  itemsCount: number
  filterCount: number
  rangePreset: string
  segment: FlowSegment
  hasHistory: boolean
}

/**
 * Which empty state the ledger shows. Emptiness comes from the unfiltered range, so an empty
 * In or Out segment is never mistaken for an empty month.
 */
export function selectFlowEmptyState({ allCount, itemsCount, filterCount, rangePreset, segment, hasHistory }: FlowEmptyInput): FlowEmptyState {
  if (itemsCount > 0) return 'none'
  if (filterCount > 0 || rangePreset !== 'month') return 'noMatch'
  if (allCount === 0) return hasHistory ? 'emptyMonth' : 'setup'
  return segment === 'all' ? 'none' : 'emptySegment'
}
