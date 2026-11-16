'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PurchasesStoreProduct } from '@revenuecat/purchases-capacitor'
import { defaultPackId, type SparksPack } from '@/components/features/usage/SparksPackPicker'
import { useBillingStore } from '@/lib/billing/billingStore'
import { loadSparksProducts, purchaseProduct, purchasesAvailable, restorePurchases } from '@/lib/billing/purchases'
import { useUsageStore } from '@/lib/usage/usageStore'

/**
 * The Sparks packs for sale, in the store's own prices, and a purchase. The packs are the products the server lists (owner-set ids);
 * the store returns only those it offers here. A purchase ends in a notice (done, failed, restored); the Sparks arrive through the
 * webhook, so the balance is re-read a few times until it moves.
 */
export function useSparksPacks(active: boolean) {
  const sparkProducts = useBillingStore((s) => s.me?.sparkProducts)
  const [products, setProducts] = useState<Map<string, PurchasesStoreProduct> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!active || !purchasesAvailable() || !sparkProducts?.length) return
    let live = true
    loadSparksProducts(sparkProducts.map((p) => p.id)).then((list) => {
      if (live) setProducts(new Map(list.map((p) => [p.identifier, p])))
    }).catch(() => live && setProducts(new Map()))
    return () => { live = false }
  }, [active, sparkProducts])

  const packs: SparksPack[] = (sparkProducts ?? []).flatMap((p) => {
    const product = products?.get(p.id)
    return product ? [{ id: p.id, sparks: p.sparks, price: product.priceString }] : []
  })
  const chosen = selected && packs.some((p) => p.id === selected) ? selected : defaultPackId(packs)

  const buy = useCallback(async (): Promise<boolean> => {
    const product = chosen ? products?.get(chosen) : undefined
    if (!product) return false
    const push = useUsageStore.getState().push
    setBusy(true)
    const before = useBillingStore.getState().me?.usage?.sparksLeft ?? 0
    const outcome = await purchaseProduct(product)
    if (outcome === 'purchased') {
      push({ type: 'purchase', outcome: 'pending' })
      for (let i = 0; i < 6; i++) {
        const me = await useBillingStore.getState().refresh()
        if ((me?.usage?.sparksLeft ?? 0) > before) break
        await new Promise((r) => setTimeout(r, 2000))
      }
      push({ type: 'purchase', outcome: 'ok' })
    } else if (outcome === 'failed') {
      push({ type: 'purchase', outcome: 'fail' })
    }
    setBusy(false)
    return outcome === 'purchased'
  }, [chosen, products])

  /** Brings back earlier purchases; the confirmation toast comes only once the plan or the balance has really moved. */
  const restore = useCallback(async (): Promise<void> => {
    setBusy(true)
    const before = useBillingStore.getState().me?.usage?.sparksLeft ?? 0
    const result = await restorePurchases()
    const me = await useBillingStore.getState().refresh()
    if (result === 'restored' && ((me?.usage?.sparksLeft ?? 0) > before || (me && me.planKey !== 'free'))) useUsageStore.getState().push({ type: 'purchase', outcome: 'restored' })
    setBusy(false)
  }, [])

  return { packs, loading: !!sparkProducts?.length && products === null && purchasesAvailable(), selected: chosen, setSelected, buy, restore, busy, available: purchasesAvailable() }
}
