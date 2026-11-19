'use client'

import { useEffect } from 'react'
import { RewardsView } from '@/components/features/rewards/RewardsView'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { PlanPending } from '@/components/features/billing/PlanPending'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { navigate } from '@/lib/navigation/navigate'

/** Rewards: reads the already-loaded plan state; no call of its own. */
export default function RewardsPage() {
  const c = useRewardsCopy().rewards
  const me = useBillingStore((s) => s.me)
  const on = billingOn(me)

  useEffect(() => {
    if (me && !on) navigate('/settings', { replace: true })
  }, [me, on])

  if (me && !on) return null
  return (
    <SettingsSubPageShell title={c.title}>
      {!me ? <PlanPending /> : me.rewards ? <RewardsView rewards={me.rewards} /> : <p role="status" dir="auto" className="text-sm text-[var(--color-brand-text-secondary)]">{c.off}</p>}
    </SettingsSubPageShell>
  )
}
