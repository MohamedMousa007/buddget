'use client'

import { WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { usePendingSmsPreviews } from '@/hooks/usePendingSmsPreviews'
import { useHiddenStatus } from '@/hooks/useHiddenStatus'
import { StatusPill } from '@/components/ui/StatusPill'
import { monoDigits } from '@/lib/ui/monoDigits'

/** Offline is a state, not a question: the amber status pill, with captured SMS counted in. */
export function OfflineBanner() {
  const t = useT()
  const { online } = useNetworkStatus()
  const waiting = usePendingSmsPreviews().length
  const [hidden, hide] = useHiddenStatus('offline')

  if (online) return null

  return (
    <StatusPill
      icon={<WifiOff strokeWidth={2} />}
      label={waiting > 0 ? t.status.offlinePending(waiting) : t.common.offlineBanner}
      visible={!hidden}
      onHide={hide}
      hiddenHint={monoDigits(t.status.hiddenReturns)}
    />
  )
}
