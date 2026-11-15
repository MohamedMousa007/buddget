'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { refreshUntilPaid } from '@/lib/billing/billingStore'
import { buildPlanOptions, type PlanOption } from '@/lib/billing/planOptions'
import { loadPackages, purchasePackage, restorePurchases } from '@/lib/billing/purchases'

/** Loads the store's packages while `active`, and runs a purchase or a restore. Both end by refreshing the plan; callers draw the notes. */
export function usePlanPurchase(active: boolean, messages: { purchaseFailed: string; waitingForStore: string; restoreNothing: string }) {
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null)
  const [picked, setPicked] = useState<'annual' | 'monthly'>('annual')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let live = true
    loadPackages().then((p) => live && setPackages(p)).catch(() => live && setPackages([]))
    return () => { live = false }
  }, [active])

  const options = buildPlanOptions(packages ?? [])
  const chosen: PlanOption | undefined = options.find((o) => o.kind === picked) ?? options[0]

  /** Resolves true once the purchase went through and the plan shows. */
  const buy = useCallback(async (option: PlanOption): Promise<boolean> => {
    setBusy(true)
    setNote(null)
    const outcome = await purchasePackage(option.pkg)
    if (outcome === 'failed') setNote(messages.purchaseFailed)
    if (outcome === 'purchased') {
      setNote(messages.waitingForStore)
      await refreshUntilPaid()
    }
    setBusy(false)
    return outcome === 'purchased'
  }, [messages.purchaseFailed, messages.waitingForStore])

  /** Resolves true when a purchase was restored and the plan shows. App Review expects Restore on the purchase screen itself. */
  const restore = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setNote(null)
    const restored = (await restorePurchases()) === 'restored' && (await refreshUntilPaid(3))
    setBusy(false)
    if (!restored) setNote(messages.restoreNothing)
    return restored
  }, [messages.restoreNothing])

  return { packages, options, chosen, picked, setPicked, busy, note, setNote, buy, restore }
}
