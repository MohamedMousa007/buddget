'use client'

import { useEffect } from 'react'
import { PlansView } from '@/components/features/billing/PlansView'
import { ProStateView } from '@/components/features/billing/ProStateView'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { navigate } from '@/lib/navigation/navigate'

/** Buddget Pro: the plans page for a Free account, the state page for everyone else. Unreachable while the server's billing switch is off. */
export default function ProPage() {
  const c = useMembershipCopy()
  const me = useBillingStore((s) => s.me)
  const on = billingOn(me)

  useEffect(() => {
    if (me && !on) navigate('/settings', { replace: true })
  }, [me, on])

  if (me && !on) return null
  return (
    <SettingsSubPageShell title={c.state.title}>
      {!me ? <p role="status" className="text-sm text-[var(--color-brand-text-muted)]">{c.state.loading}</p> : subscriptionView(me).kind === 'free' ? <PlansView /> : <ProStateView me={me} />}
    </SettingsSubPageShell>
  )
}
