import { describe, expect, it } from 'vitest'
import { transactionTime } from './transactionTime'

// Instants are built from local wall times so the file holds in every TZ the suite runs in.
const local = (wall: string) => new Date(wall).toISOString()

describe('transactionTime', () => {
  it('shows the local time of a row that carries one on its own day', () => {
    expect(transactionTime(local('2026-11-20T15:30:00'), '2026-11-20', 'en')).toBe('3:30 PM')
  })

  it('is null without a time', () => {
    expect(transactionTime(undefined, '2026-11-20', 'en')).toBeNull()
    expect(transactionTime(null, '2026-11-20', 'en')).toBeNull()
  })

  it('is null when the instant falls on another local day than the row', () => {
    expect(transactionTime(local('2026-11-20T00:30:00'), '2026-11-20', 'en')).toBe('12:30 AM')
    expect(transactionTime(local('2026-11-21T00:30:00'), '2026-11-20', 'en')).toBeNull()
  })

  it('is null for the invented local noon of a re-dated row', () => {
    expect(transactionTime(new Date('2026-11-20T12:00:00').toISOString(), '2026-11-20', 'en')).toBeNull()
    expect(transactionTime(new Date('2026-11-20T12:00:01').toISOString(), '2026-11-20', 'en')).not.toBeNull()
  })

  it('formats in Arabic with Latin digits', () => {
    expect(transactionTime(local('2026-11-20T15:30:00'), '2026-11-20', 'ar')).toMatch(/3:30/)
  })
})
