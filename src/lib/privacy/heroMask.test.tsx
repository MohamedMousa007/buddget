import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { TrophyHero } from '@/components/features/goals/TrophyHero'
import { SavingsHero } from '@/components/features/savings-v3/SavingsHero'
import { DebtPortfolioHero } from '@/components/features/debts/redesign/DebtPortfolioHero'
import { ReportsNetWorthPanel } from '@/components/reports/ReportsNetWorthPanel'
import { MASK, isMasked } from './mask'

// renderToStaticMarkup reads zustand's server snapshot (initial state), so the live setting is bridged here.
vi.mock('./useMask', () => ({
  useMask: (surface: Parameters<typeof isMasked>[1]) => isMasked(useFinanceStore.getState().settings.privacy, surface),
}))
vi.mock('@/components/auth/AuthProvider', async (orig) => ({
  ...(await orig<object>()),
  useAuth: () => ({ session: null, user: null, loading: false }),
}))

const setPrivacy = (privacy: { preset: 'off' | 'hero' | 'all' }) =>
  useFinanceStore.setState((s) => ({ settings: { ...s.settings, privacy } }))

afterEach(() => setPrivacy({ preset: 'off' }))

const trophy = h(TrophyHero, { stats: { count: 2, totalLabel: 'EGP 98,765', avgMonths: 4, early: 1, checkpoints: 8 } })
const wealth = h(SavingsHero, {
  total: '123,456', currency: 'EGP', netWorth: '654,321', split: [{ key: 'a', label: 'Cash', value: '111,222', pct: 100 }], badges: null,
})
const debts = h(DebtPortfolioHero, {
  owed: 77777, base: 'EGP', clearedPct: 10, borrowedTotal: 90000, activeCount: 1, nextPayment: null, dueThisMonth: 0,
  paidThisMonth: 0, debtFreeDate: null, unplannedCount: 0, lastClearedAt: null, paidOff: 5000, clearedCount: 0,
})

describe('hero balance privacy', () => {
  it('masks the Reports net worth band', () => {
    setPrivacy({ preset: 'hero' })
    expect(renderToStaticMarkup(h(ReportsNetWorthPanel))).toContain(MASK)
  })
  it('shows balances when privacy is off', () => {
    expect(renderToStaticMarkup(trophy)).toContain('98,765')
    expect(renderToStaticMarkup(wealth)).toContain('123,456')
    expect(renderToStaticMarkup(debts)).toContain('77,777')
  })
  it('masks the hero figures when the hero surface is hidden', () => {
    setPrivacy({ preset: 'hero' })
    for (const el of [trophy, wealth, debts]) {
      const html = renderToStaticMarkup(el)
      expect(html).toContain(MASK)
      expect(html).not.toMatch(/98,765|123,456|654,321|111,222|77,777/)
    }
  })
})
