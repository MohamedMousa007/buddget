'use client'

import { WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function OfflineBanner() {
  const t = useT()
  const { online } = useNetworkStatus()

  if (online) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-[var(--color-brand-amber)] text-black text-xs text-center py-1.5 font-medium flex items-center justify-center gap-1.5 safe-area-top">
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden />
      {t.common.offlineBanner}
    </div>
  )
}
