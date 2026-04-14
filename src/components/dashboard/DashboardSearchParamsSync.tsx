'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

function SyncInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)

  useEffect(() => {
    if (searchParams.get('action') === 'addExpense') {
      setActiveModal('addExpense')
      router.replace('/', { scroll: false })
    }
  }, [searchParams, router, setActiveModal])

  return null
}

/**
 * Opens quick-add expense when PWA shortcut visits `/?action=addExpense`.
 */
export function DashboardSearchParamsSync() {
  return (
    <Suspense fallback={null}>
      <SyncInner />
    </Suspense>
  )
}
