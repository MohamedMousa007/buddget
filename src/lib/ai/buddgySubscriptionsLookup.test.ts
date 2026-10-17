import { describe, expect, it } from 'vitest'
import { runLookup } from '@/lib/ai/buddgyLookup'
import type { FinanceStore } from '@/lib/store/types'

const store = (subscriptions: unknown[]) =>
  ({ settings: { baseCurrency: 'EGP' }, subscriptions, expenses: [], paymentMethods: [], exchangeRates: {} }) as unknown as FinanceStore

describe('runLookup subscriptions', () => {
  it('labels each subscription with its status so a cancelled one is not reported as live', () => {
    const out = runLookup(
      store([
        { name: 'Netflix', currency: 'EGP', amount: 190, billingCycle: 'monthly', status: 'active' },
        { name: 'Spotify', currency: 'EGP', amount: 60, billingCycle: 'monthly', status: 'cancelled' },
      ]),
      { kind: 'subscriptions' }
    )
    expect(out).toContain('Netflix: EGP 190 / monthly (active)')
    expect(out).toContain('Spotify: EGP 60 / monthly (cancelled)')
  })

  it('says so when nothing is tracked', () => {
    expect(runLookup(store([]), { kind: 'subscriptions' })).toBe('No tracked subscriptions.')
  })
})
