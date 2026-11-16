'use client'

import { useState } from 'react'
import { AlertTriangle, Check, CircleHelp, Crown, ExternalLink, ListChecks, Settings2, RotateCcw, Sparkles } from 'lucide-react'
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
import { PlansView, ComingSoon } from '@/components/features/billing/PlansView'
import { ModalShell } from '@/components/modals/ModalShell'
import { SheetBody } from '@/components/features/savings-v3/MoneySheetParts'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { refreshUntilPaid, type BillingMe } from '@/lib/billing/billingStore'
import { smsAccountsOn, smsLoggedThisMonth } from '@/lib/billing/proof'
import { STORE_LINKS, openManageSubscription, purchasesAvailable, restorePurchases } from '@/lib/billing/purchases'
import { getPlatform } from '@/lib/native/isNative'
import { subscriptionView, type SubscriptionView } from '@/lib/billing/subscriptionView'
import { useLocale } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

type Purchase = NonNullable<NonNullable<BillingMe['subscription']>['purchases']>[number]

function purchaseLabel(p: Purchase, b: { proYearly: string; proMonthly: string; sparksOf: (n: number) => string }): string {
  const id = p.productId ?? ''
  if (id.startsWith('plus_annual')) return b.proYearly
  if (id.startsWith('plus_monthly')) return b.proMonthly
  const n = /^sparks_(\d+)/.exec(id)?.[1]
  return n ? b.sparksOf(Number(n)) : id
}

function priceText(p: Purchase, tag: string): string {
  if (p.priceMicros === null || !p.currency) return ''
  try { return new Intl.NumberFormat(tag, { style: 'currency', currency: p.currency }).format(p.priceMicros / 1_000_000) } catch { return `${(p.priceMicros / 1_000_000).toFixed(2)} ${p.currency}` }
}

/** Live-price estimates a day on Pro (plans.limits). */
const PRO_ESTIMATES_PER_DAY = 10

function trialSegments(day: number): Segment[] {
  return Array.from({ length: 30 }, (_, i) => (i + 1 < day ? 'kept' : i + 1 === day ? 'now' : 'empty'))
}

/** The Pro page for everyone who is not on a plain Free plan: the card, the facts that apply to this state, Sparks, what is included, manage and restore. */
/** Welcome to Pro: shown once after a first purchase, "Welcome back" after a restore. The card, three facts of the plan, one button. */
export function WelcomeToPro({ me, back, onDone }: { me: BillingMe; back: boolean; onDone: () => void }) {
  const c = useMembershipCopy()
  const { locale } = useLocale()
  const view = subscriptionView(me)
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  return (
    <div className="space-y-5">
      <MembershipHero tone="pro">
        <MemberCard kind="pro" mark={c.mark} facts={[{ label: c.state.memberSince, value: date(view.memberSince) }, { label: c.state.renews, value: date(view.until) }]} />
        <h1 dir="auto" className="text-2xl font-extrabold leading-tight tracking-tight rtl:font-bold rtl:tracking-normal">{back ? c.welcome.back : c.welcome.title}</h1>
      </MembershipHero>
      <Card padding="md" className="space-y-3">
        {c.welcome.rows.map((row) => (
          <p key={row} dir="auto" className="flex items-center gap-2.5 text-sm text-[var(--color-brand-text-primary)]">
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]"><Check className="size-3.5" aria-hidden /></span>
            {row}
          </p>
        ))}
        <p dir="auto" className="pt-1 text-xs text-[var(--color-brand-text-secondary)]">{c.welcome.price}</p>
      </Card>
      <Button size="cta-block" onClick={onDone} className="font-semibold">{c.welcome.start}</Button>
    </div>
  )
}

export function ProStateView({ me }: { me: BillingMe }) {
  const c = useMembershipCopy()
  const s = c.state
  const { locale } = useLocale()
  const view: SubscriptionView = subscriptionView(me)
  const paymentMethods = useFinanceStore((st) => st.paymentMethods)
  const expenses = useFinanceStore((st) => st.expenses)
  const [plans, setPlans] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [allOpen, setAllOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const store = purchasesAvailable()
  const fromStore = !!me.subscription?.fromStore
  const b = c.billing
  const android = getPlatform() === 'android'
  const storeName = android ? c.plans.playStore : c.plans.appStore
  const links = android ? STORE_LINKS.android : STORE_LINKS.ios
  const purchases = me.subscription?.purchases ?? []

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
          <Card padding="md" className="space-y-2.5">
            <h2 dir="auto" className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{s.trial.tryTitle}</h2>
            {s.trial.tries.map((row, i) => (
              <Button key={row} variant="outline" size="touch" className="w-full justify-start font-semibold" onClick={() => (i === 1 ? useSettingsStore.getState().setActiveModal('scanReceipt') : useSettingsStore.getState().setActiveModal('aiChat'))}>{row}</Button>
            ))}
          </Card>
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
        <FactsTable rows={[...(view.period ? [{ label: s.plan, value: s.period[view.period] }] : []), { label: s.memberSince, value: date(view.memberSince, true) }, { label: untilLabel, value: date(view.until, true) }]} />
      ) : null}

      {sparks && view.proActive ? (
        <SettingsSection title={c.sparks.title}>
          <SettingsRow
            icon={Sparkles}
            tone={2}
            title={s.sparksOf(sparks.left, sparks.total)}
            subtitle={sparks.resetsAt ? s.sparksResets(date(sparks.resetsAt)) : s.sparksNote}
            href="/settings/pro/usage"
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

      {view.kind !== 'trial' ? (
        <section className="space-y-3">
          <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{b.section}</h2>
          <SettingsSection>
            {store && fromStore ? <SettingsRow icon={Settings2} title={b.manage(storeName)} subtitle={b.manageHint} onClick={() => void openManageSubscription()} settingId="manageSubscription" /> : null}
            {fromStore ? <SettingsRow icon={CircleHelp} title={b.howCancel} subtitle={b.howCancelHint} onClick={() => setCancelOpen((v) => !v)} /> : null}
            {store ? <SettingsRow icon={RotateCcw} title={b.restore} onClick={() => void restore()} settingId="restorePurchases" /> : null}
          </SettingsSection>
          {cancelOpen ? (
            <Card padding="md" className="space-y-2">
              {(android ? b.steps.playStore : b.steps.appStore).map((step, i) => (
                <p key={step} dir="auto" className="flex items-start gap-3 text-sm text-[var(--color-brand-text-primary)]">
                  <span dir="ltr" className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-brand-primary-soft)] font-semibold text-[var(--color-brand-primary-ink)]">{i + 1}</span>
                  <span className="flex-1 pt-0.5">{step}</span>
                </p>
              ))}
            </Card>
          ) : null}
          <SettingsSection title={b.purchases}>
            {purchases.length === 0 ? (
              <div dir="auto" className="px-4 py-4"><p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{b.none}</p><p className="mt-0.5 text-xs text-[var(--color-brand-text-secondary)]">{b.noneHint}</p></div>
            ) : purchases.slice(0, 5).map((p) => (
              <SettingsRow key={`${p.at}-${p.productId}`} icon={ListChecks} title={purchaseLabel(p, b)} subtitle={date(p.at, true)} value={priceText(p, intlTag(locale))} />
            ))}
            {purchases.length > 5 ? <SettingsRow icon={ListChecks} title={b.seeAll} onClick={() => setAllOpen(true)} /> : null}
          </SettingsSection>
          <p dir="auto" className="px-1 text-xs leading-snug text-[var(--color-brand-text-secondary)]">{b.lastSaw}</p>
          <SettingsSection>
            <SettingsRow icon={ExternalLink} title={b.receipts(storeName)} onClick={() => window.open(links.receipts, '_blank', 'noopener')} />
            <SettingsRow icon={CircleHelp} title={b.problem} subtitle={b.problemBody(storeName)} onClick={() => window.open(links.problem, '_blank', 'noopener')} />
          </SettingsSection>
        </section>
      ) : null}
      {included ? <ComingSoon interest={me.usage?.interest ?? []} /> : null}
      {allOpen ? (
        <ModalShell open onBackdropClick={() => setAllOpen(false)} scrollChild>
          <div className="flex min-h-0 flex-1 flex-col">
            <V3SheetHeader onClose={() => setAllOpen(false)}><V3SheetHeader.Title>{b.purchases}</V3SheetHeader.Title></V3SheetHeader>
            <SheetBody className="pt-1">
              <SettingsSection>
                {purchases.map((p) => <SettingsRow key={`all-${p.at}-${p.productId}`} icon={ListChecks} title={purchaseLabel(p, b)} subtitle={date(p.at, true)} value={priceText(p, intlTag(locale))} />)}
              </SettingsSection>
            </SheetBody>
          </div>
        </ModalShell>
      ) : null}
      {note ? <p role="status" className="px-1 text-xs text-[var(--color-brand-text-secondary)]">{note}</p> : null}
      <p className="flex gap-1 text-xs">
        <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/terms" />} className="text-[var(--color-brand-text-secondary)]">{c.plans.terms}</Button>
        <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/privacy" />} className="text-[var(--color-brand-text-secondary)]">{c.plans.privacyLink}</Button>
      </p>
    </div>
  )
}
