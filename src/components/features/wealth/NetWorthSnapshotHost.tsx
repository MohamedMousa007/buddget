'use client'

import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAuth } from '@/components/auth/auth-context'
import { useAssetPrices } from '@/hooks/useAssetPrices'
import { useDailyNetWorthSnapshot } from '@/hooks/useDailyNetWorthSnapshot'
import { useNetWorth } from '@/hooks/useNetWorth'
import { netWorthBasisOf } from '@/lib/savings/netWorth'
import { snapshotDay, snapshotStampKey } from '@/lib/savings/netWorthSnapshot'
import { buildWealth } from '@/lib/savings/wealthModel'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** The net worth figure, with the same completeness test the Wealth page uses before it saves one. */
function SnapshotWriter({ onWritten }: { onWritten: () => void }) {
  const nw = useNetWorth()
  const { lookup } = useAssetPrices()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { savingsAccounts, investmentHoldings, settings, exchangeRates, goldPricePerGram, goldPriceAvailable } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts,
      investmentHoldings: s.investmentHoldings,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram,
      goldPriceAvailable: s.goldPriceAvailable,
    })),
  )
  const base = settings.baseCurrency
  const model = useMemo(
    () => buildWealth({ accounts: savingsAccounts, holdings: investmentHoldings, lookup, baseCurrency: base, rates: exchangeRates, goldPricePerGram, goldOk: goldPriceAvailable !== false }),
    [savingsAccounts, investmentHoldings, lookup, base, exchangeRates, goldPricePerGram, goldPriceAvailable],
  )
  useDailyNetWorthSnapshot(nw.netWorth, base, dataReady && !model.anyUnpriced && !nw.netWorthIncomplete, netWorthBasisOf(nw), onWritten)
  return null
}

/**
 * Net worth history only grew while the Wealth page was open, which starves the Insights net worth path. This saves one
 * snapshot a day from anywhere. The calculation mounts only while today's snapshot is still missing, so after the first
 * open of the day it costs nothing.
 */
export function NetWorthSnapshotHost() {
  const userId = useAuth().user?.id
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const [writtenFor, setWrittenFor] = useState<string | null>(null)
  const onWritten = useCallback(() => setWrittenFor(`${userId}:${base}:${snapshotDay(new Date())}`), [userId, base])
  if (!userId) return null
  const today = snapshotDay(new Date())
  let lastDay: string | null = null
  try { lastDay = window.localStorage.getItem(snapshotStampKey(userId, base)) } catch { /* storage unavailable: write once per mount */ }
  if (lastDay === today || writtenFor === `${userId}:${base}:${today}`) return null
  return <SnapshotWriter onWritten={onWritten} />
}
