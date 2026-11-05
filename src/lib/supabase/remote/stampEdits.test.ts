import { describe, expect, it } from 'vitest'
import { stampEdits } from './stampEdits'
import { emptySnapshot } from './snapshot'
import type { SavingsAccount } from '@/lib/store/types'

const acc = (over: Partial<SavingsAccount> = {}) => ({ id: 'a1', name: 'Pocket', currentBalance: 10, createdAt: '2026-10-01T00:00:00Z', ...over }) as SavingsAccount
const slices = (savingsAccounts: SavingsAccount[]) => ({ ...emptySnapshot(), savingsAccounts })

describe('stampEdits (SYN5)', () => {
  it('stamps a row whose content changed without its stamp moving', () => {
    const patch = stampEdits(slices([acc()]), slices([acc({ name: 'Renamed' })]), '2026-10-05T00:00:00.000Z')
    expect(patch?.savingsAccounts?.[0]).toMatchObject({ name: 'Renamed', updatedAt: '2026-10-05T00:00:00.000Z' })
  })
  it('leaves a row from the server (newer stamp), new rows and untouched rows alone', () => {
    expect(stampEdits(slices([acc()]), slices([acc({ name: 'x', updatedAt: '2026-10-06T00:00:00.000+00:00' })]), 'now')).toBeNull()
    expect(stampEdits(slices([]), slices([acc()]), 'now')).toBeNull()
    expect(stampEdits(slices([acc()]), slices([acc()]), 'now')).toBeNull()
  })
  it('is idempotent: the stamped state needs no further stamp', () => {
    const first = stampEdits(slices([acc()]), slices([acc({ name: 'B' })]), 'T1')!
    expect(stampEdits(slices([acc({ name: 'B' })]), { ...emptySnapshot(), ...first }, 'T2')).toBeNull()
  })
})
