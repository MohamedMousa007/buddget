'use client'

import { useState } from 'react'
import { CreditCard, RotateCcw, Settings2, Sparkles } from 'lucide-react'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { billingOn, isPaidPlan, refreshUntilPaid, useBillingStore } from '@/lib/billing/billingStore'
import { openManageSubscription, purchasesAvailable, restorePurchases } from '@/lib/billing/purchases'
import { useLocale, useT } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'

/** Plan, Sparks and the store actions. Absent while the server's billing switch is off. */
export function SubscriptionCard() {
  const t = useT().billing
  const { locale } = useLocale()
  const me = useBillingStore((s) => s.me)
  const openPaywall = useBillingStore((s) => s.openPaywall)
  const [note, setNote] = useState<string | null>(null)
  if (!billingOn(me) || !me) return null

  const day = (iso: string) => new Date(iso).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'long' })
  const paid = isPaidPlan(me)
  const store = purchasesAvailable()
  const plan = paid ? t.planPlus : t.planFree
  const status = me.status === 'trialing' && me.trialEndsAt ? t.trialEnds(day(me.trialEndsAt)) : t.statusLine[me.status]

  const restore = async () => {
    setNote(null)
    if ((await restorePurchases()) === 'failed') return setNote(t.restoreNothing)
    setNote((await refreshUntilPaid(3)) ? t.restored : t.restoreNothing)
  }

  return (
    <SettingsSection title={t.sectionTitle}>
      <SettingsRow icon={CreditCard} tone={1} title={plan} subtitle={status} trailing={<span />} settingId="subscription" />
      {me.sparks ? (
        <SettingsRow
          icon={Sparkles}
          tone={2}
          title={t.sparksLeft(me.sparks.left, me.sparks.total)}
          subtitle={me.sparks.resetsAt ? t.sparksRefill(day(me.sparks.resetsAt)) : undefined}
          trailing={<span />}
        />
      ) : null}
      {store && !paid ? <SettingsRow icon={Sparkles} tone={4} title={t.upgrade} subtitle={t.upgradeHint} onClick={openPaywall} settingId="upgrade" /> : null}
      {store ? <SettingsRow icon={Settings2} title={t.manage} subtitle={t.manageHint} onClick={() => void openManageSubscription()} settingId="manageSubscription" /> : null}
      {store ? <SettingsRow icon={RotateCcw} title={t.restore} subtitle={t.restoreHint} onClick={() => void restore()} settingId="restorePurchases" /> : null}
      {note ? <p role="status" className="px-4 py-3 text-xs text-[var(--color-brand-text-secondary)]">{note}</p> : null}
    </SettingsSection>
  )
}
