'use client'

import { useEffect } from 'react'
import { PlansView } from '@/components/features/billing/PlansView'
import { ProStateView, WelcomeToPro } from '@/components/features/billing/ProStateView'
import { useUsageStore } from '@/lib/usage/usageStore'
import { ProMark } from '@/components/features/membership/ProMark'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { billingOn, useBillingStore } from '@/lib/billing/billingStore'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import { planPageStateOf } from '@/components/features/billing/planBilling'
import { Gauge } from 'lucide-react'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useUsageCopy } from '@/lib/i18n/usageCopy'
import { navigate } from '@/lib/navigation/navigate'

/** buddget Pro: the plans page for a Free account, the state page for everyone else. Unreachable while the server's billing switch is off. */
export default function ProPage() {
  const c = useMembershipCopy()
  const usage = useUsageCopy()
  const me = useBillingStore((s) => s.me)
  const on = billingOn(me)
  const welcome = useUsageStore((s) => s.welcome)
  const setWelcome = useUsageStore((s) => s.setWelcome)

  useEffect(() => {
    if (me && !on) navigate('/settings', { replace: true })
  }, [me, on])

  if (me && !on) return null
  return (
    <SettingsSubPageShell title={c.state.title} lead={<ProMark size="lg" faded={me ? subscriptionView(me).kind === 'expired' : false} className="me-2" />}>
      {!me ? <p role="status" className="text-sm text-[var(--color-brand-text-muted)]">{c.state.loading}</p> : welcome && subscriptionView(me).proActive ? <WelcomeToPro me={me} back={welcome === 'back'} onDone={() => setWelcome(null)} /> : planPageStateOf(me) === 'free' ? <PlansView /> : <ProStateView me={me} />}
      {me ? <SettingsSection><SettingsRow icon={Gauge} tone={2} title={usage.page.title} href="/settings/pro/usage" settingId="usage" /></SettingsSection> : null}
    </SettingsSubPageShell>
  )
}
