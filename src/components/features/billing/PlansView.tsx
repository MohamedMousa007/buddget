'use client'

import { useEffect, type ReactNode } from 'react'
import { Infinity, Lightbulb, Sparkles } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiBase'
import { notifyComingSoon, type ComingSoonFeature } from '@/lib/billing/comingSoon'
import { useState } from 'react'
import { MembershipHero, HeroStat } from '@/components/features/membership/MembershipHero'
import { PlanCompare } from '@/components/features/membership/PlanCompare'
import { AppLink as Link } from '@/components/ui/AppLink'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useBillingStore } from '@/lib/billing/billingStore'
import { useUsageStore } from '@/lib/usage/usageStore'
import { smsAccountsOn, smsLoggedThisMonth } from '@/lib/billing/proof'
import { purchasesAvailable } from '@/lib/billing/purchases'
import { usePlanPurchase } from '@/lib/billing/usePlanPurchase'
import { useT } from '@/lib/i18n'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { getPlatform } from '@/lib/native/isNative'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/** The Free plan tracks two bank or wallet accounts (plans.limits.sms_accounts_max). */
const FREE_SMS_ACCOUNTS = 2

function Outcome({ icon: Icon, title, text }: { icon: typeof Sparkles; title: string; text: string }) {
  return (
    <Card padding="md" className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]"><Icon className="size-5" aria-hidden /></span>
      <span dir="auto" className="min-w-0">
        <span className="block text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{text}</span>
      </span>
    </Card>
  )
}

/** What is coming to Pro, with a Notify me for each: shown below what Pro includes today and never in the purchase table. */
// A selector must return a stable value: a fresh [] on every render loops forever when usage is missing.
const NO_INTEREST: string[] = []

export function ComingSoon({ interest }: { interest: readonly string[] }) {
  const p = useMembershipCopy().plans.comingSoon
  const [noted, setNoted] = useState<readonly string[]>(interest)
  const rows: Array<{ id: ComingSoonFeature; label: string }> = [{ id: 'partner_sharing', label: p.partner }, { id: 'advanced_insights', label: p.insights }]
  return (
    <section className="space-y-2">
      <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{p.title}</h2>
      <Card padding="none" divide className="overflow-hidden">
        {rows.map((r) => (
          <div key={r.id} dir="auto" className="flex min-h-[52px] items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1 text-sm text-[var(--color-brand-text-primary)]">{r.label}</span>
            {noted.includes(r.id) ? (
              <Badge tone="soft" size="sm">{p.noted}</Badge>
            ) : (
              <Button size="touch" variant="ghost" className="font-semibold text-[var(--color-brand-primary-ink)]" onClick={() => void notifyComingSoon(r.id).then((ok) => ok && setNoted((n) => [...n, r.id]))}>{p.notify}</Button>
            )}
          </div>
        ))}
      </Card>
    </section>
  )
}

function Prompt({ children }: { children: ReactNode }) {
  return <p dir="auto" className="text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]">{children}</p>
}

/**
 * The plans page: promise, proof from the person's own data, three outcomes, Free against Pro, then the price. For a Free account this
 * is the whole of /settings/pro; the sticky footer says what the button does.
 */
export function PlansView() {
  const t = useT().billing
  const c = useMembershipCopy()
  const p = c.plans
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)
  const expenses = useFinanceStore((s) => s.expenses)
  const { packages, options, chosen, setPicked, busy, note, buy: purchase, restore: bringBack } = usePlanPurchase(true, t)
  const buy = async (o: Parameters<typeof purchase>[0]) => { if (await purchase(o)) useUsageStore.getState().setWelcome('new') }
  const restore = async () => { if (await bringBack()) useUsageStore.getState().setWelcome('back') }
  const available = purchasesAvailable()
  // Measurement only (S5c item 27): one paywall view per visit; the server reads the country and ignores it while billing is off.
  useEffect(() => {
    void apiFetchAuth('/api/billing/paywall-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'plans' }) }).catch(() => undefined)
  }, [])
  const store = getPlatform() === 'android' ? p.playStore : p.appStore
  const interest = useBillingStore((st) => st.me?.usage?.interest ?? NO_INTEREST)
  const smsOn = smsAccountsOn(paymentMethods)
  const logged = smsLoggedThisMonth(expenses)

  const yearly = options.find((o) => o.kind === 'annual')
  const monthly = options.find((o) => o.kind === 'monthly')
  const saving = yearly && monthly && monthly.pkg.product.price > 0
    ? Math.round((1 - yearly.pkg.product.price / (monthly.pkg.product.price * 12)) * 100)
    : 0

  return (
    <div className="space-y-5">
      <MembershipHero tone="pro">
        <Badge tone="onBrand" size="md" className="self-start border border-[var(--member-line)]">{p.yourPlan}</Badge>
        <h1 dir="auto" className="text-[1.9375rem] font-extrabold leading-[1.1] tracking-tight [text-wrap:balance] rtl:text-[1.625rem] rtl:font-bold rtl:leading-[1.35] rtl:tracking-normal">{p.promise}</h1>
        <p dir="auto" className="text-sm leading-relaxed text-[var(--member-fg-2)]">{p.lede}</p>
        {smsOn > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            <HeroStat value={`${Math.min(smsOn, FREE_SMS_ACCOUNTS)}/${FREE_SMS_ACCOUNTS}`} label={p.proofAccounts} />
            <HeroStat value={logged} label={p.proofLogged} />
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--member-line)] bg-black/20 p-3">
            <p className="text-[0.6875rem] font-bold text-[var(--member-fg-2)]">{p.sample}</p>
            <p dir="ltr" className="rounded-[10px] bg-white/5 px-2.5 py-2 font-mono-numbers text-[0.6875rem] leading-snug text-[var(--member-fg-2)]">{p.sampleMessage}</p>
            <p dir="auto" className="rounded-xl bg-[var(--color-brand-card)] px-2.5 py-2 text-sm font-semibold text-[var(--color-brand-text-primary)]">{p.sampleRow}</p>
          </div>
        )}
        <p dir="auto" className="text-xs leading-snug text-[var(--member-fg-2)]">{p.privacy}</p>
      </MembershipHero>

      <section className="space-y-2.5">
        <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{p.whatProAdds}</h2>
        <Outcome icon={Sparkles} title={p.outcomes.moreAi.t} text={p.outcomes.moreAi.d} />
        <Outcome icon={Lightbulb} title={p.outcomes.advisor.t} text={p.outcomes.advisor.d} />
        <Outcome icon={Infinity} title={p.outcomes.noLimits.t} text={p.outcomes.noLimits.d} />
      </section>

      <section className="space-y-3">
        <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{p.compareTitle}</h2>
        <PlanCompare head={p.compareHead} rows={p.compareRows} />
        <Prompt>{p.stayFree}</Prompt>
      </section>

      <ComingSoon interest={interest} />

      <section className="space-y-3">
        <h2 dir="auto" className="text-xl font-extrabold tracking-tight text-[var(--color-brand-text-primary)] rtl:font-bold rtl:tracking-normal">{p.choose}</h2>
        {!available ? (
          <Prompt>{p.notOnThisDevice}</Prompt>
        ) : packages === null ? (
          <p role="status" className="text-xs text-[var(--color-brand-text-muted)]">{t.loading}</p>
        ) : options.length === 0 ? (
          <p role="status" className="text-xs text-[var(--color-brand-amber)]">{p.pricesUnavailable}</p>
        ) : (
          <div role="radiogroup" aria-label={p.choose} className="flex flex-col gap-2.5">
            {options.map((o) => (
              <SelectableCard key={o.kind} selected={chosen?.kind === o.kind} onClick={() => setPicked(o.kind)} disabled={busy} surface="card" className="min-h-[72px] p-4">
                <span dir="auto" className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">
                    {o.kind === 'annual' ? p.yearly : p.monthly}
                    {o.kind === 'annual' ? <Badge tone="brand" size="sm">{p.best}</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-[0.78125rem] leading-snug text-[var(--color-brand-text-secondary)]">
                    {o.kind === 'annual' ? `${o.perMonth ? p.aboutPerMonth(o.perMonth) : ''} ${saving > 0 ? p.saving(saving) : ''}`.trim() : p.monthlyNote}
                  </span>
                </span>
                <span dir="ltr" className="text-end">
                  <span className="font-mono-numbers block text-xl font-semibold text-[var(--color-brand-text-primary)]">{o.price}</span>
                  <span className="block text-xs text-[var(--color-brand-text-secondary)]">{o.kind === 'annual' ? p.aYear : p.aMonth}</span>
                </span>
              </SelectableCard>
            ))}
          </div>
        )}
        {available && options.length > 0 ? (
          <>
            <Prompt>{p.priceHold}</Prompt>
            <Prompt>{p.makeItRight}</Prompt>
            <Card padding="md" className="space-y-1">
              <h3 dir="auto" className="text-sm font-bold text-[var(--color-brand-text-primary)]">{p.howTitle}</h3>
              <Prompt>{chosen?.kind === 'monthly' ? p.howMonthly(chosen.price) : p.howYearly(chosen?.price ?? '')} {p.howStore(store)}</Prompt>
            </Card>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          {available ? (
            <Button size="touch" variant="ghost" disabled={busy} onClick={() => void restore()} className="font-semibold text-[var(--color-brand-primary-ink)]">{t.restore}</Button>
          ) : null}
          <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/terms" />} className="text-[var(--color-brand-text-secondary)]">{p.terms}</Button>
          <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/privacy" />} className="text-[var(--color-brand-text-secondary)]">{p.privacyLink}</Button>
        </div>
        {note ? <p role="status" className="text-xs leading-snug text-[var(--color-brand-text-secondary)]">{note}</p> : null}
      </section>

      {available && chosen ? (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-4 pb-3 pt-3 lg:bottom-0 lg:pe-24">
          <Button size="cta-block" loading={busy} onClick={() => void buy(chosen)} className="font-semibold">
            {chosen.kind === 'annual' ? p.continueYearly : p.continueMonthly}
          </Button>
          <p dir="auto" className="mt-1.5 text-center text-xs text-[var(--color-brand-text-secondary)]">
            <span dir="ltr" className="font-mono-numbers">{chosen.price}</span> {chosen.kind === 'annual' ? p.aYear : p.aMonth} · {p.renewsAutomatically}
          </p>
        </div>
      ) : null}
    </div>
  )
}
