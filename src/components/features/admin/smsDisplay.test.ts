import { describe, expect, it } from 'vitest'
import { rowStatus } from './smsDisplay'
import type { SmsTrackedRow } from './types'

describe('rowStatus undone', () => {
  it('labels a discarded message, neutral', () => {
    const row = { status: 'undone', parsed_ok: false, failure_code: null, received_at: new Date().toISOString() } as unknown as SmsTrackedRow
    expect(rowStatus(row, Date.now())).toEqual({ label: 'Undone by user', tone: 'neutral' })
  })
})
