'use client'

import { useMemo } from 'react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { computeInsightsNow } from './now'
import type { Insight } from './types'

/** The top three finding kinds joined. A change in what leads the page is what counts as new. */
export const insightsSignature = (insights: readonly Insight[]): string => insights.slice(0, 3).map((i) => i.kind).join('|')

/** True while the page leads with findings the user has not seen. Computed on the device when the ledger changes. */
export function useInsightsDot(): boolean {
  const seen = useSettingsStore((s) => s.insightsSeen)
  const count = useFinanceStore((s) => s.expenses.length)
  const ready = useFinanceStore((s) => s.dataReady)
  const sig = useMemo(() => {
    if (!ready) return ''
    try {
      return insightsSignature(computeInsightsNow(useFinanceStore.getState()).insights)
    } catch {
      return ''
    }
    // `count` is a trigger only: a new purchase can change the findings, and the snapshot is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, count])
  return sig !== '' && sig !== seen
}
