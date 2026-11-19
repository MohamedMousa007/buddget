'use client'

import { useEffect } from 'react'
import { InviteView } from '@/components/features/invite/InviteView'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { PlanPending } from '@/components/features/billing/PlanPending'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { navigate } from '@/lib/navigation/navigate'

/** Invite friends: the code and link come from the loaded plan state; the page adds one summary call for the friends list. */
export default function InvitePage() {
  const c = useRewardsCopy().invite
  const me = useBillingStore((s) => s.me)
  const on = billingOn(me)

  useEffect(() => {
    if (me && !on) navigate('/settings', { replace: true })
  }, [me, on])

  if (me && !on) return null
  return (
    <SettingsSubPageShell title={c.title}>
      {me ? <InviteView me={me} /> : <PlanPending />}
    </SettingsSubPageShell>
  )
}
