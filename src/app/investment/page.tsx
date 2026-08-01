'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useHydrateSavings } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { InvestmentView } from '@/components/features/savings-v3/InvestmentView'
import { AddInvestmentSheet } from '@/components/features/savings-v3/AddInvestmentSheet'
import type { InvestmentAssetType } from '@/lib/store/types'

/** Dedicated Investment tab (More menu). Renders the same InvestmentView the savings page shows. */
export default function InvestmentPage() {
  useHydrateSavings()
  const router = useRouter()
  const requireAuth = useRequireAuthAction()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<InvestmentAssetType | null>(null)

  const devBypass =
    process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === '1'
  const guard = (fn: () => void) => (devBypass ? fn() : requireAuth(fn, 'Sign in to manage investments'))

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <>
      <InvestmentView
        onBackToSavings={() => router.push('/savings')}
        onAddInvestment={(t) => guard(() => { setAddType(t); setAddOpen(true) })}
      />
      {addOpen && <AddInvestmentSheet open presetType={addType} onClose={() => setAddOpen(false)} />}
    </>
  )
}
