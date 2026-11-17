'use client'

import { useEffect, useState } from 'react'
import { apiFetchAuth } from '@/lib/apiBase'
import { InviteCta } from '@/components/features/invite/InviteCta'
import { PlanCompareShowcase } from '@/components/features/membership/PlanCompareShowcase'
import { Fine, PageStack, Section } from '@/components/features/rewards/pageParts'
import { AppLink as Link } from '@/components/ui/AppLink'
import { Button } from '@/components/ui/button'
import { useBillingStore } from '@/lib/billing/billingStore'
import { purchasesAvailable } from '@/lib/billing/purchases'
import { claimTrial } from '@/lib/billing/trialClaim'
import { usePlanPurchase } from '@/lib/billing/usePlanPurchase'
import { useT } from '@/lib/i18n'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { getPlatform } from '@/lib/native/isNative'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useUsageStore } from '@/lib/usage/usageStore'
import { PlansBlock } from './PlansBlock'
import { planDisplays, priceRegion } from './planBilling'

/** The plans a person can choose and the purchase behind them: the store's packages when it answers, the owner's prices until then. */
export function usePlanChoice() {
  const t = useT().billing
  const purchase = usePlanPurchase(true, t)
  const country = useFinanceStore((s) => s.profile.country)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const plans = planDisplays(priceRegion(country, baseCurrency), purchase.options)
  const chosen = plans.find((p) => p.kind === purchase.picked) ?? plans[0]!
  return { ...purchase, plans, chosen }
}

/** Restore, Terms and Privacy: the links every purchase screen carries. */
export function StoreLinks({ onRestore, disabled }: { onRestore: () => void; disabled?: boolean }) {
  const c = useMembershipCopy()
  const p = useRewardsCopy().plan
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <Button size="touch" variant="ghost" disabled={disabled} onClick={onRestore} className="text-xs text-[var(--color-brand-text-secondary)] underline">{p.restoreLink}</Button>
      <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/terms" />} className="text-xs text-[var(--color-brand-text-secondary)] underline">{c.plans.terms}</Button>
      <Button size="touch" variant="ghost" nativeButton={false} render={<Link href="/privacy" />} className="text-xs text-[var(--color-brand-text-secondary)] underline">{c.plans.privacyLink}</Button>
    </div>
  )
}

/**
 * Plan and billing for a Free account: what Free has beside what Pro adds, the 30 days, then the plans. Buying needs the store;
 * where it is not there yet the buttons say so and nothing else happens.
 */
export function PlansView() {
  const p = useRewardsCopy().plan
  const { plans, chosen, picked, setPicked, busy, note, setNote, buy, restore } = usePlanChoice()
  const refresh = useBillingStore((s) => s.refresh)
  const [starting, setStarting] = useState(false)
  const android = getPlatform() === 'android'

  // Measurement only (S5c item 27): one paywall view per visit; the server reads the country and ignores it while billing is off.
  useEffect(() => {
    void apiFetchAuth('/api/billing/paywall-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'plans' }) }).catch(() => undefined)
  }, [])

  const startTrial = async () => {
    setStarting(true)
    setNote(null)
    const status = await claimTrial()
    if (status === 'granted' || status === 'already_entitled') await refresh()
    else setNote(status === 'already_claimed' ? p.trialUsed : p.trialFailed)
    setStarting(false)
  }
  const purchase = async () => {
    if (!purchasesAvailable() || !chosen.option) return setNote(p.notYet)
    if (await buy(chosen.option)) useUsageStore.getState().setWelcome('new')
  }
  const bringBack = async () => {
    if (!purchasesAvailable()) return setNote(p.notYet)
    if (await restore()) useUsageStore.getState().setWelcome('back')
  }

  return (
    <PageStack>
      <PlanCompareShowcase
        head={{ pill: p.freePill, title: p.showTitle, subtitle: p.showSub }}
        freeTitle={p.colFree}
        proTitle={p.colPro}
        nowLabel={p.now}
        rows={p.rows}
        footnote={p.footnote}
      />
      <div className="grid gap-2">
        <Button size="cta-block" loading={starting} disabled={busy} onClick={() => void startTrial()} className="font-bold">{p.trialCta}</Button>
        <Fine>{p.trialFine}</Fine>
      </div>
      <Section title={p.orChoose}>
        <div className="pt-1.5"><PlansBlock plans={plans} selected={picked} onSelect={setPicked} disabled={busy} label={p.orChoose} /></div>
      </Section>
      <div className="grid gap-2">
        <Button size="touch" variant="outline" loading={busy} disabled={starting} onClick={() => void purchase()} className="w-full font-semibold">
          {chosen.kind === 'annual' ? p.continueYearly : p.continueMonthly}
        </Button>
        {note ? <p role="status" dir="auto" className="text-center text-xs leading-snug text-[var(--color-brand-text-secondary)]">{note}</p> : null}
        <Fine>{android ? p.storeFine.android : p.storeFine.ios}</Fine>
        <StoreLinks onRestore={() => void bringBack()} disabled={busy} />
      </div>
      <InviteCta />
    </PageStack>
  )
}
