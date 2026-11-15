'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Crown, Settings2, RotateCcw, Sparkles } from 'lucide-react'
import { MemberCard } from '@/components/features/membership/MemberCard'
import { MembershipHero } from '@/components/features/membership/MembershipHero'
import { SegmentStrip, type Segment } from '@/components/features/membership/SegmentStrip'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { AppLink as Link } from '@/components/ui/AppLink'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FactsTable } from '@/components/ui/FactsTable'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { StatTile } from '@/components/ui/StatTile'
import { PlansView } from '@/components/features/billing/PlansView'
import { refreshUntilPaid, type BillingMe } from '@/lib/billing/billingStore'
import { smsAccountsOn, smsLoggedThisMonth } from '@/lib/billing/proof'
import { openManageSubscription, purchasesAvailable, restorePurchases } from '@/lib/billing/purchases'
import { subscriptionView, type SubscriptionView } from '@/lib/billing/subscriptionView'
import { useLocale } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** Live-price estimates a day on Pro (plans.limits). */
const PRO_ESTIMATES_PER_DAY = 10

function trialSegments(day: number): Segment[] {
  return Array.from({ length: 14 }, (_, i) => (i + 1 < day ? 'kept' : i + 1 === day ? 'now' : 'empty'))
}

/** The Pro page for everyone who is not on a plain Free plan: the card, the facts that apply to this state, Sparks, what is included, manage and restore. */
export function ProStateView({ me }: { me: BillingMe }) {
  const c = useMembershipCopy()
  const s = c.state
  const { locale } = useLocale()
  const view: SubscriptionView = subscriptionView(me)
  const paymentMethods = useFinanceStore((st) => st.paymentMethods)
  const expenses = useFinanceStore((st) => st.expenses)
  const [plans, setPlans] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const store = purchasesAvailable()
  const fromStore = !!me.subscription?.fromStore

  const date = (iso: string | null, long = false) => (iso ? new Date(iso).toLocaleDateString(intlTag(locale), { day: 'numeric', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}) }) : '')
  const smsOn = smsAccountsOn(paymentMethods)
  const sparks = me.sparks

  const restore = async () => {
    setNote(null)
    if ((await restorePurchases()) === 'failed') return setNote(s.restoreNothing)
    setNote((await refreshUntilPaid(3)) ? s.restored : s.restoreNothing)
  }

  if (plans) return <PlansView />

  const memberCardState = view.kind === 'issue' ? 'grace' : view.kind === 'expired' ? 'expired' : 'active'
  const chip =
    view.kind === 'trial' ? s.trial.chip
    : view.kind === 'issue' ? s.issue.chip
    : view.kind === 'expired' ? s.expired.chip
    : view.period ? s.period[view.period] : ''
  const untilLabel = view.kind === 'trial' ? s.trial.movesToFree : view.kind === 'issue' || view.kind === 'canceled' ? s.proUntil : view.kind === 'expired' ? s.ended : s.renews
  const facts: [{ label: string; value: string }, { label: string; value: string }?] =
    view.kind === 'trial'
      ? [{ label: s.trial.day, value: `${view.trialDay} / ${view.trialTotal}` }, { label: untilLabel, value: date(view.until) }]
      : [{ label: s.memberSince, value: date(view.memberSince) }, { label: untilLabel, value: date(view.until) }]

  const included = view.proActive
  return (
    <div className="space-y-5">
      <MembershipHero tone="pro">
        <Badge tone="onBrand" size="md" className="self-start border border-[var(--member-line)]">{chip}</Badge>
        <MemberCard kind="pro" state={memberCardState} mark={c.mark} facts={facts} />
        {view.kind === 'trial' && view.trialDay ? <SegmentStrip segments={trialSegments(view.trialDay)} label={s.trial.day} onSurface /> : null}
      </MembershipHero>

      {view.kind === 'issue' ? (
        <PromptBanner
          title={s.issue.title}
          description={s.issue.body(date(view.until, true))}
          icon={<AlertTriangle className="size-[18px]" aria-hidden />}
          tone="warning"
          confirmLabel={s.issue.fix}
          onConfirm={() => void openManageSubscription()}
        />
      ) : null}

      {view.kind === 'trial' ? (
        <>
          <p dir="auto" className="text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">{s.trial.line(date(view.until, true))}</p>
          <section className="space-y-2">
            <p dir="auto" className="text-xs font-bold text-[var(--color-brand-text-muted)]">{s.trial.soFar}</p>
            <div className="grid grid-cols-2 gap-2">
              <StatTile compact label={s.trial.accounts} value={smsOn} />
              <StatTile compact label={s.trial.logged} value={smsLoggedThisMonth(expenses)} />
            </div>
          </section>
        </>
      ) : null}

      {view.kind === 'expired' ? (
        <Card padding="md" className="space-y-2">
          <h2 dir="auto" className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{s.expired.title}</h2>
          {s.expired.lines.map((line) => (
            <p key={line} dir="auto" className="text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{line}</p>
          ))}
        </Card>
      ) : null}

      {view.kind === 'active' || view.kind === 'canceled' || view.kind === 'issue' ? (
        <FactsTable rows={[{ label: s.plan, value: view.period ? s.period[view.period] : '' }, { label: s.memberSince, value: date(view.memberSince, true) }, { label: untilLabel, value: date(view.until, true) }]} />
      ) : null}

      {sparks && view.proActive ? (
        <SettingsSection title={c.sparks.title}>
          <SettingsRow
            icon={Sparkles}
            tone={2}
            title={s.sparksOf(sparks.left, sparks.total)}
            subtitle={sparks.resetsAt ? s.sparksResets(date(sparks.resetsAt)) : s.sparksNote}
            href="/settings/pro/sparks"
            trailing={<ProgressRing pct={sparks.total ? (sparks.left / sparks.total) * 100 : 0} size={36} stroke={4} arc="var(--color-brand-primary)" track="var(--color-brand-border-strong)" />}
          />
        </SettingsSection>
      ) : null}

      {me.loyalty && (me.loyalty.founderNumber !== null || me.loyalty.betaTester) ? (
        <SettingsSection title={c.founders.title}>
          <SettingsRow icon={Crown} tone={2} title={s.founderRow} subtitle={s.founderHint} href="/settings/founders" />
        </SettingsSection>
      ) : null}

      {included ? (
        <Card padding="md" className="space-y-3">
          <h2 dir="auto" className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{s.included}</h2>
          {[s.includedRows.sms(smsOn), s.includedRows.year, s.includedRows.plans, s.includedRows.sparks(sparks?.total ?? 100, PRO_ESTIMATES_PER_DAY)].map((row) => (
            <p key={row} dir="auto" className="flex items-center gap-2.5 text-sm text-[var(--color-brand-text-primary)]">
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]"><Check className="size-3.5" aria-hidden /></span>
              {row}
            </p>
          ))}
        </Card>
      ) : null}

      {view.kind === 'trial' || view.kind === 'expired' ? (
        <div className="space-y-1.5">
          <Button size="cta-block" onClick={() => setPlans(true)} className="font-semibold">{view.kind === 'trial' ? s.trial.seePlans : s.expired.rejoin}</Button>
          <p dir="auto" className="text-center text-xs text-[var(--color-brand-text-secondary)]">{view.kind === 'trial' ? s.trial.noCard : s.expired.back}</p>
        </div>
      ) : null}

      <SettingsSection>
        {store && fromStore ? <SettingsRow icon={Settings2} title={s.manage} subtitle={s.manageHint} onClick={() => void openManageSubscription()} settingId="manageSubscription" /> : null}
        {store ? <SettingsRow icon={RotateCcw} title={s.restore} onClick={() => void restore()} settingId="restorePurchases" /> : null}
      </SettingsSection>
      {note ? <p role="status" className="px-1 text-xs text-[var(--color-brand-text-secondary)]">{note}</p> : null}
      <p className="flex gap-1 text-xs">
        <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/terms" />} className="text-[var(--color-brand-text-secondary)]">{c.plans.terms}</Button>
        <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/privacy" />} className="text-[var(--color-brand-text-secondary)]">{c.plans.privacyLink}</Button>
      </p>
    </div>
  )
}
