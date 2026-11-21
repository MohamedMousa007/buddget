'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor'
import { confirmWithStore, useBillingStore } from '@/lib/billing/billingStore'
import { buildPlanOptions, type PlanOption } from '@/lib/billing/planOptions'
import { completePurchase, completeRestore, shelfOf } from '@/lib/billing/purchaseFlow'
import { loadPackages, onPurchasesChange, purchasesAvailable, purchasesStatus, retryPurchases } from '@/lib/billing/purchases'

const idle = () => 'idle' as const

/**
 * Loads the store's packages while `active`, once the SDK is ready (and again when it becomes ready), and runs a purchase or a
 * restore. Success means the server shows the store's Pro; callers draw the notes.
 */
export function usePlanPurchase(active: boolean, messages: { purchaseFailed: string; confirming: string; restoreNothing: string }) {
  const sdk = useSyncExternalStore(onPurchasesChange, purchasesStatus, idle)
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [picked, setPicked] = useState<'annual' | 'monthly'>('annual')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (!active || sdk !== 'ready') return
    let live = true
    loadPackages().then((p) => live && setPackages(p)).catch(() => live && setPackages([]))
    return () => { live = false }
  }, [active, sdk, attempt])

  const shelf = shelfOf(purchasesAvailable(), sdk, packages)
  const options = buildPlanOptions(packages ?? [])
  const chosen: PlanOption | undefined = options.find((o) => o.kind === picked) ?? options[0]

  /** After "Buying isn't available": start the SDK again if it failed, otherwise ask the store for its packages again. */
  const retry = useCallback(() => {
    setPackages(null)
    if (purchasesStatus() === 'failed') void retryPurchases()
    else setAttempt((n) => n + 1)
  }, [])

  /** Resolves true once the purchase went through and the server shows the store's Pro. */
  const buy = useCallback(async (option: PlanOption): Promise<boolean> => {
    setBusy(true)
    setNote(null)
    setPending(false)
    const outcome = await completePurchase(option.pkg)
    if (outcome === 'failed') setNote(messages.purchaseFailed)
    if (outcome === 'pending') setPending(true)
    setBusy(false)
    return outcome === 'confirmed'
  }, [messages.purchaseFailed])

  /** "Check again" while confirming: the server reads RevenueCat for this account. Resolves true once the store's Pro shows. */
  const confirm = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    const ok = await confirmWithStore()
    setBusy(false)
    if (ok) setPending(false)
    return ok
  }, [])

  /** Resolves true when a purchase was restored and the plan shows. App Review expects Restore on the purchase screen itself. */
  const restore = useCallback(async (): Promise<boolean> => {
    setBusy(true)
    setNote(null)
    const restored = (await completeRestore(useBillingStore.getState().me)) === 'restored'
    setBusy(false)
    if (!restored) setNote(messages.restoreNothing)
    return restored
  }, [messages.restoreNothing])

  return { packages, options, chosen, picked, setPicked, busy, note, setNote, buy, restore, shelf, retry, pending, confirm }
}
