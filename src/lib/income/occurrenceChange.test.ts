import { describe, expect, it } from 'vitest'
import { occurrenceChange } from './occurrenceChange'

describe('occurrenceChange', () => {
  it('unlinking clears the payday', () => {
    expect(occurrenceChange({ templateId: 's1', occurrenceDate: '2026-10-01' }, '', '2026-10-03')).toEqual({ occurrenceDate: null })
  })
  it('linking to a source sets the payday from the received date', () => {
    expect(occurrenceChange({ templateId: null, occurrenceDate: null }, 's1', '2026-10-03')).toEqual({ occurrenceDate: '2026-10-03' })
  })
  it('switching source resets the payday', () => {
    expect(occurrenceChange({ templateId: 's1', occurrenceDate: '2026-09-01' }, 's2', '2026-10-03')).toEqual({ occurrenceDate: '2026-10-03' })
  })
  it('an unchanged link keeps its payday', () => {
    expect(occurrenceChange({ templateId: 's1', occurrenceDate: '2026-10-01' }, 's1', '2026-10-03')).toEqual({})
  })
})
