'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'

export function OfflineBanner() {
  const t = useT()
  const [offline, setOffline] = useState(
    () => typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine
  )

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[100] bg-[var(--color-brand-amber)] text-black text-xs text-center py-1.5 font-medium flex items-center justify-center gap-1.5 safe-area-top">
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden />
      {t.common.offlineBanner}
    </div>
  )
}
