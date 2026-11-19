import { describe, expect, it } from 'vitest'
import { subtitle } from './WealthList'
import { en } from '@/lib/i18n/dictionaries/en'
import type { WealthRowVM } from './types'

const row = (account: Record<string, unknown>) => ({ account } as unknown as WealthRowVM)
const sub = (r: WealthRowVM, goal?: string) => subtitle(r, en.wealthPage, en.savingsForms.identity, 'en', goal)

describe('Wealth row sub-line', () => {
  it('does not repeat the pocket name when it has no institution or type line (the system vault)', () => {
    expect(sub(row({ type: 'cash', name: 'Monthly Savings' }))).toBe('')
    expect(sub(row({ type: 'cash', name: 'Monthly Savings' }), 'Feeds New car · 62%')).toBe('Feeds New car · 62%')
  })
  it('keeps a real identity line', () => {
    expect(sub(row({ type: 'bank', name: 'Rainy day', institution: 'CIB' }))).toContain('CIB')
  })
})
