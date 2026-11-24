'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Check, CircleHelp, CircleX } from 'lucide-react'
import { useAuth } from '@/components/auth/AuthProvider'
import { InviteCta } from '@/components/features/invite/InviteCta'
import { CardSpotlight } from '@/components/features/membership/FlipCardRig'
import { MemberCard } from '@/components/features/membership/MemberCard'
import { MembershipHero } from '@/components/features/membership/MembershipHero'
import { MembershipPanel } from '@/components/features/membership/PointsList'
import { ProMemberCard } from '@/components/features/membership/ProMemberCard'
import { ProMonthPanel } from '@/components/features/membership/ProMonthPanel'
import { Fine, PageStack, SectionTitle, Sub, cardDate, plainDate, withBold } from '@/components/features/rewards/pageParts'
import { cardFinishClass } from '@/components/features/rewards/cosmetics'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { ModalShell } from '@/components/modals/ModalShell'
import { SheetBody } from '@/components/features/savings-v3/MoneySheetParts'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { apiFetchAuth } from '@/lib/apiBase'
import { type BillingMe, useBillingStore } from '@/lib/billing/billingStore'
import { PRO_PACK_BONUS } from '@/lib/billing/packBonus'
import { STORE_LINKS, openManageSubscription, purchaseWithOffer, purchasesAvailable } from '@/lib/billing/purchases'
import type { StayOfferAnswer } from '@/lib/billing/stayOffer'
import { subscriptionView, type SubscriptionView } from '@/lib/billing/subscriptionView'
import { useLocale, useT } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useMembershipCopy } from '@/lib/i18n/membershipCopy'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { getPlatform } from '@/lib/native/isNative'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useUsageStore } from '@/lib/usage/usageStore'
import { historyPrice } from './BillingHistory'
import { PlansBlock } from './PlansBlock'
import { BuyLine, StoreLinks, usePlanChoice } from './PlansView'
import { monthView, multipleLabel } from './planBilling'

/** Welcome to Pro: shown once after a first purchase, "Welcome back" after a restore. The card, three facts of the plan, one button. */
export function WelcomeToPro({ me, back, onDone }: { me: BillingMe; back: boolean; onDone: () => void }) {
  const c = useMembershipCopy()
  const { locale } = useLocale()
  const view = subscriptionView(me)
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  return (
    <div className="space-y-5">
      <MembershipHero tone="pro">
        <MemberCard kind="pro" mark={c.mark} facts={view.memberSince ? [{ label: c.state.memberSince, value: date(view.memberSince) }, { label: c.state.renews, value: date(view.until) }] : [{ label: c.state.renews, value: date(view.until) }]} />
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

type Sheet = 'cancel' | 'plans' | null

/** `0427`: the member number as the card prints it. */
export const memberNumber = (n: number | null | undefined): string => (n == null ? '—' : String(n).padStart(4, '0'))

/**
 * Plan and billing for a trial and for a member: the Pro card on its rig, "Pro this month" from real use, and at the end Change plan
 * and Cancel subscription. Everything that changes a subscription goes to the store; the app only links there.
 */
export function ProStateView({ me }: { me: BillingMe }) {
  const c = useMembershipCopy()
  const r = useRewardsCopy()
  const p = r.plan
  const s = c.state
  const b = c.billing
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()
  const view: SubscriptionView = subscriptionView(me)
  const trial = view.kind === 'trial'
  const { plans, chosen, picked, setPicked, busy, setNote, restore, shelf, line, purchaseChosen } = usePlanChoice()
  const name = useFinanceStore((st) => st.profile.name) || t.common.user
  const [sheet, setSheet] = useState<Sheet>(null)
  const [stay, setStay] = useState<Extract<StayOfferAnswer, { eligible: true }> | null>(null)
  const [stayBusy, setStayBusy] = useState(false)
  const [stayNote, setStayNote] = useState<string | null>(null)
  /** The stay-offer result, drawn under the card; purchase and restore notes sit under the buy button in the plans sheet. */
  const [barNote, setBarNote] = useState<string | null>(null)
  const keepRef = useRef<HTMLDivElement>(null)

  const rewards = me.rewards ?? null
  const fromStore = !!me.subscription?.fromStore
  const store = purchasesAvailable()
  const android = getPlatform() === 'android'
  const ios = getPlatform() === 'ios'
  const storeName = android ? c.plans.playStore : c.plans.appStore
  const links = android ? STORE_LINKS.android : STORE_LINKS.ios
  const history = me.history ?? []
  const date = (iso: string | null) => plainDate(iso, locale)
  const inStore = android ? p.store.android : p.store.ios

  const yearly = plans.find((x) => x.kind === 'annual') ?? plans[0]!
  const receipt = history.find((h) => h.kind === 'subscription' && h.priceMicros !== null)
  const price = (receipt ? historyPrice(receipt) : '') || (plans.find((x) => x.kind === (view.period === 'monthly' ? 'monthly' : 'annual')) ?? yearly).price
  const periodPrice = view.period === 'monthly' ? p.card.perMonth(price) : p.card.perYear(price)
  const ending = view.kind === 'canceled' || view.kind === 'issue'

  const purchase = async () => {
    if (await purchaseChosen()) { setSheet(null); useUsageStore.getState().setWelcome('new') }
  }
  const bringBack = async () => {
    if (!store) return setNote(p.notYet)
    // Restore lives only in the plans sheet, next to buying; the answer sits under the buy button.
    setNote((await restore()) ? s.restored : s.restoreNothing)
  }

  // Cancel subscription: on iOS a store member is shown the stay offer first, once (the server decides); everyone else goes straight to the store.
  const openCancel = async () => {
    setStay(null)
    setStayNote(null)
    if (ios && store && fromStore) {
      const answer: StayOfferAnswer = await apiFetchAuth('/api/billing/stay-offer').then((r) => r.json()).catch(() => ({ eligible: false }))
      if (answer.eligible) setStay(answer)
    }
    setSheet('cancel')
  }
  const stayWithPro = async () => {
    const option = stay && (plans.find((x) => x.kind === (stay.productId === 'pro_annual' ? 'annual' : 'monthly'))?.option ?? null)
    if (!stay || !option) return setStayNote(b.stay.failed)
    setStayBusy(true)
    const out = await purchaseWithOffer(option.pkg, stay.offerId)
    setStayBusy(false)
    if (out === 'cancelled') return
    if (out !== 'purchased') return setStayNote(b.stay.failed)
    // Stamp now so the offer never shows again, even before the store's webhook lands.
    await apiFetchAuth('/api/billing/stay-offer', { method: 'POST' }).catch(() => undefined)
    void useBillingStore.getState().refresh()
    setStay(null)
    setSheet(null)
    setBarNote(b.stay.done)
  }

  const changePlan = () => (store && fromStore ? void openManageSubscription() : setSheet('plans'))
  const canCancel = !trial && fromStore && view.kind !== 'canceled'

  const month = me.proThisMonth ? monthView(me.proThisMonth, me.usage?.balanceViews.used ?? 0) : null
  const recap = month ? (
    <ProMonthPanel
      kicker={trial ? p.month.kickerTrial : p.month.kickerPro}
      title={month.multiple >= 2 ? withBold(p.month.titleTimes, multipleLabel(month.multiple)) : month.multiple > 1 ? p.month.titlePast : p.month.titleInside}
      subtitle={month.passed >= month.tiles.length ? p.month.subAll : month.passed > 0 ? p.month.subSome(month.passed) : p.month.subInside}
      youLabel={p.month.you}
      tiles={month.tiles.map((tile) => ({
        value: String(tile.value),
        label: p.month[tile.key],
        delta: !trial && tile.deltaPct !== null ? `${tile.deltaPct > 0 ? '+' : ''}${tile.deltaPct}%` : undefined,
        freeCapPct: tile.capPct,
        capLabel: withBold(p.month.freeStops, <span dir="ltr">{`${tile.approx ? '≈' : ''}${tile.cap}`}</span>),
      }))}
    />
  ) : null

  const plansChoice = (
    <>
      <PlansBlock plans={plans} selected={picked} onSelect={setPicked} disabled={busy} label={p.manage.plansTitle} />
      <Button size="cta-block" loading={busy || shelf === 'loading'} onClick={() => void purchase()} className="font-bold">{trial ? p.keep.cta : chosen.kind === 'annual' ? p.continueYearly : p.continueMonthly}</Button>
      <BuyLine line={line} busy={busy} />
    </>
  )

  return (
    <PageStack>
      <CardSpotlight hint={p.card.tap}>
        <ProMemberCard
          className={cardFinishClass(rewards?.cosmetics.cardFinish)}
          flipLabel={p.card.flip}
          front={{
            mark: trial ? p.card.markTrial : p.card.markPro,
            name,
            tier: rewards?.tier?.key,
            tierLabel: rewards?.tier ? r.tierLabel(r.tiers[rewards.tier.key].name) : undefined,
            planLine: trial ? p.card.lineTrial : fromStore && view.period ? p.card.linePro(view.period === 'monthly' ? p.card.periodMonthly : p.card.periodYearly, inStore) : p.card.linePromo,
            facts: [
              { label: p.card.memberSince, value: cardDate(view.memberSince ?? user?.created_at) || '—' },
              { label: trial ? p.card.trialEnds : ending ? p.card.until : p.card.renews, value: cardDate(view.until) || '—' },
              { label: p.card.member, value: memberNumber(rewards?.memberNumber) },
            ],
          }}
          back={{
            mark: p.card.includedMark,
            included: p.card.included(Math.max(PRO_PACK_BONUS, rewards?.packBonusPercent ?? 0)),
            billing: trial
              ? [p.card.thenPrice(yearly.price), p.card.noCharge]
              : !fromStore ? [c.proName, view.until ? p.card.ends(date(view.until)) : '']
                : [periodPrice, view.until ? (ending ? p.card.ends(date(view.until)) : p.card.next(date(view.until))) : ''],
          }}
        />
      </CardSpotlight>

      {view.kind === 'issue' ? (
        <PromptBanner
          title={s.issue.title}
          description={s.issue.body(date(view.until))}
          icon={<AlertTriangle className="size-[18px]" aria-hidden />}
          tone="warning"
          confirmLabel={s.issue.fix}
          onConfirm={() => void openManageSubscription()}
        />
      ) : null}

      {barNote && sheet === null ? <p role="status" dir="auto" className="px-1 text-xs text-[var(--color-brand-text-secondary)]">{barNote}</p> : null}

      {trial ? (
        <MembershipPanel className="grid gap-3.5 p-4">
          <div ref={keepRef}>
            <SectionTitle>{p.keep.title(plainDate(view.until, locale, false))}</SectionTitle>
            <Sub className="mt-1">{p.keep.body(plainDate(view.until, locale, false))}</Sub>
          </div>
          <div className="grid gap-3.5 pt-1.5">{plansChoice}</div>
          <Button size="touch" variant="ghost" onClick={() => navigate('/settings/invite')} className="h-auto min-h-11 w-full whitespace-normal text-center text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">{r.invite.billingLine}</Button>
        </MembershipPanel>
      ) : null}

      {recap}

      <InviteCta />

      {!trial ? (
        <>
          <SettingsSection>
            <SettingsRow icon={ArrowRightLeft} title={p.manage.changePlan} onClick={changePlan} settingId="changePlan" />
          </SettingsSection>
          {canCancel ? (
            <SettingsSection>
              <SettingsRow icon={CircleX} title={b.cancelRow} destructive onClick={() => void openCancel()} settingId="cancelSubscription" />
            </SettingsSection>
          ) : null}
          {fromStore ? <Fine>{`${b.billedBy} ${storeName}`}</Fine> : null}
        </>
      ) : null}

      {sheet ? (
        <ModalShell open onBackdropClick={() => setSheet(null)} scrollChild>
          <div className="flex min-h-0 flex-1 flex-col">
            <V3SheetHeader onClose={() => setSheet(null)}>
              <V3SheetHeader.Title>{sheet === 'cancel' ? b.cancelRow : p.manage.plansTitle}</V3SheetHeader.Title>
              {sheet === 'cancel' ? (
                <V3SheetHeader.Extra>
                  <IconButton aria-label={b.problem} variant="tinted" size="sm" shape="round" onClick={() => window.open(links.problem, '_blank', 'noopener')}>
                    <CircleHelp size={16} />
                  </IconButton>
                </V3SheetHeader.Extra>
              ) : null}
            </V3SheetHeader>
            <SheetBody className="space-y-4 pb-5 pt-1">
              {sheet === 'plans' ? (
                <>
                  <div className="grid gap-3.5 pt-2">{plansChoice}</div>
                  <Fine>{android ? p.storeFine.android : p.storeFine.ios}</Fine>
                  <StoreLinks onRestore={() => void bringBack()} disabled={busy} />
                </>
              ) : stay ? (
                <Card padding="md" className="space-y-3">
                  <p dir="auto" className="text-base font-bold leading-snug text-[var(--color-brand-text-primary)]">{stay.productId === 'pro_annual' ? b.stay.titleAnnual : b.stay.titleMonthly}</p>
                  <p dir="auto" className="text-sm text-[var(--color-brand-text-secondary)]">{b.stay.keep(rewards?.streak.current ?? 0, rewards?.tier ? r.tiers[rewards.tier.key].name : null)}</p>
                  {stayNote ? <p role="status" dir="auto" className="text-xs text-[var(--color-brand-text-secondary)]">{stayNote}</p> : null}
                  <Button size="cta-block" loading={stayBusy} onClick={() => void stayWithPro()} className="font-bold">{b.stay.cta}</Button>
                  <Button size="touch" variant="ghost" disabled={stayBusy} onClick={() => setStay(null)} className="w-full font-semibold text-[var(--color-brand-red)] hover:text-[var(--color-brand-red)]">{b.stay.cancelAnyway}</Button>
                </Card>
              ) : (
                <Card padding="md" className="space-y-3">
                  <p dir="auto" className="text-sm text-[var(--color-brand-text-secondary)]">{b.cancelHandoff(storeName, view.until ? date(view.until) : null)}</p>
                  <Button size="cta-block" onClick={() => void openManageSubscription()} className="font-bold">{b.cancelInStore}</Button>
                </Card>
              )}
            </SheetBody>
          </div>
        </ModalShell>
      ) : null}
    </PageStack>
  )
}
