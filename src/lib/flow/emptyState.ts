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

/** Flow's default period: every month in one list. Any other period is a filter the user chose. */
export const FLOW_DEFAULT_RANGE = 'all'

/**
 * Which empty state the ledger shows. Emptiness comes from the unfiltered range, so an empty
 * In or Out segment is never mistaken for an empty ledger.
 */
export function selectFlowEmptyState({ allCount, itemsCount, filterCount, rangePreset, segment, hasHistory }: FlowEmptyInput): FlowEmptyState {
  if (itemsCount > 0) return 'none'
  if (filterCount > 0 || rangePreset !== FLOW_DEFAULT_RANGE) return 'noMatch'
  if (allCount === 0) return hasHistory ? 'emptyMonth' : 'setup'
  return segment === 'all' ? 'none' : 'emptySegment'
}
