import { describe, expect, it } from 'vitest'
import { selectFlowEmptyState, type FlowEmptyInput } from '@/lib/flow/emptyState'
import type { FlowSegment } from '@/lib/store/useExpenseFilterStore'

const base: FlowEmptyInput = { allCount: 0, itemsCount: 0, filterCount: 0, rangePreset: 'month', segment: 'all', hasHistory: true }
const segments: FlowSegment[] = ['all', 'in', 'out']

describe('selectFlowEmptyState', () => {
  it.each(segments)('shows nothing when %s has rows', (segment) => {
    expect(selectFlowEmptyState({ ...base, segment, allCount: 3, itemsCount: 2 })).toBe('none')
  })

  it.each(segments)('%s: no rows anywhere and no history is the setup checklist', (segment) => {
    expect(selectFlowEmptyState({ ...base, segment, hasHistory: false })).toBe('setup')
  })

  it.each(segments)('%s: empty month with history elsewhere is the plain empty month', (segment) => {
    expect(selectFlowEmptyState({ ...base, segment })).toBe('emptyMonth')
  })

  it.each(['in', 'out'] as const)('%s empty while the month has other rows is the segment state', (segment) => {
    expect(selectFlowEmptyState({ ...base, segment, allCount: 4 })).toBe('emptySegment')
  })

  it.each(segments)('%s: filters with no match is noMatch even when the month is empty', (segment) => {
    expect(selectFlowEmptyState({ ...base, segment, filterCount: 1, allCount: 4 })).toBe('noMatch')
    expect(selectFlowEmptyState({ ...base, segment, filterCount: 1 })).toBe('noMatch')
  })

  it.each(segments)('%s: a non-month range with no rows is noMatch', (segment) => {
    expect(selectFlowEmptyState({ ...base, segment, rangePreset: 'week', allCount: 2 })).toBe('noMatch')
  })
})
