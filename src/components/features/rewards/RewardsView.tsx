'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { memberNumber } from '@/components/features/billing/ProStateView'
import { InviteCta } from '@/components/features/invite/InviteCta'
import { AvatarBadge } from '@/components/features/membership/AvatarBadge'
import { CardSpotlight } from '@/components/features/membership/FlipCardRig'
import { HotStreakCard } from '@/components/features/membership/HotStreakCard'
import { LetterpressTierCard } from '@/components/features/membership/LetterpressTierCard'
import { MembershipPanel, PointsList } from '@/components/features/membership/PointsList'
import { TierBadge } from '@/components/features/membership/TierBadge'
import { TierLadder } from '@/components/features/membership/TierLadder'
import { tierRank } from '@/components/features/membership/tiers'
import m from '@/components/features/membership/membership.module.css'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useBillingStore } from '@/lib/billing/billingStore'
import { useLocale, useT } from '@/lib/i18n'
import { intlTag } from '@/lib/i18n/dateFormat'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { applyCosmetic, buyShopItem, formatFounderNumber } from '@/lib/loyalty/loyaltyApi'
import type { RewardsState } from '@/lib/loyalty/rewardsTypes'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cn } from '@/lib/utils'
import { cardFinishClass } from './cosmetics'
import { Fine, PageStack, Section, initials, withBold } from './pageParts'
import { STANDARD_COSMETIC, cardProgress, cardTier, shopRowState, stripCounts, stripWeeks, streakPoints } from './rewardsState'

type ShopItem = RewardsState['shop'][number]

/** Rewards: the tier card, the 12-week streak, the ladder, where the badge shows, and the points to earn and spend. */
export function RewardsView({ rewards }: { rewards: RewardsState }) {
  const r = useRewardsCopy()
  const c = r.rewards
  const t = useT()
  const { locale } = useLocale()
  const { user } = useAuth()
  const confirm = useConfirm()
  const refresh = useBillingStore((s) => s.refresh)
  const name = useFinanceStore((s) => s.profile.name) || t.common.user
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const shown = cardTier(rewards)
  if (!shown || !rewards.tier) return <p role="status" dir="auto" className="text-sm text-[var(--color-brand-text-secondary)]">{c.off}</p>
  const real = rewards.tier.key
  const tierName = (k: keyof typeof r.tiers) => r.tiers[k].name
  const fmt = (n: number) => n.toLocaleString('en')
  const since = user?.created_at ? new Date(user.created_at).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' }) : ''
  const next = rewards.nextTier
  const nextLine = shown.tier === 'founder' ? c.highest : shown.tier === 'elite' ? c.topPro : next && next.pointsToGo > 0 ? c.toNext(fmt(next.pointsToGo), tierName(next.key)) : next ? tierName(next.key) : c.highest
  const streak = rewards.streak
  const counts = stripCounts(streak.weeks)

  const shopLabel = (item: ShopItem) => (item.kind === 'repair' ? c.shop.repair : item.kind === 'freeze' ? c.shop.freeze : item.kind === 'card_finish' ? c.shop.finish : c.shop.look)
  const press = async (item: ShopItem) => {
    const state = shopRowState(item, rewards)
    setNote(null)
    if (state === 'unavailable') return setNote(item.kind === 'repair' ? c.result.nothingToRepair : c.result.freezesFull)
    if (state !== 'buy') {
      if (item.kind !== 'card_finish' && item.kind !== 'buddgy_look') return
      setBusy(true)
      const out = await applyCosmetic(item.kind, state === 'in_use' ? STANDARD_COSMETIC[item.kind] : item.item ?? STANDARD_COSMETIC[item.kind])
      if (out === 'ok') await refresh()
      setBusy(false)
      return setNote(out === 'ok' ? c.apply.done : c.apply.fail)
    }
    const left = rewards.points.spendable - item.cost
    if (left < 0) return setNote(c.result.insufficient(-left))
    if (!(await confirm({ title: c.confirm.title(shopLabel(item)), body: c.confirm.body(item.cost, left), confirmLabel: c.confirm.cta, cancelLabel: c.confirm.cancel }))) return
    setBusy(true)
    const out = await buyShopItem(item.key)
    if (out.status === 'ok') await refresh()
    setBusy(false)
    setNote(
      out.status === 'ok' ? (item.kind === 'repair' ? c.result.repairOk : item.kind === 'freeze' ? c.result.freezeOk : c.result.ok)
        : out.status === 'insufficient_points' ? c.result.insufficient(Math.max(1, item.cost - out.balance))
          : out.status === 'freezes_full' ? c.result.freezesFull
            : out.status === 'nothing_to_repair' ? c.result.nothingToRepair
              : out.status === 'already_owned' ? c.result.alreadyOwned
                : c.result.error,
    )
  }

  return (
    <PageStack>
      <CardSpotlight hint={c.tap}>
        <LetterpressTierCard
          className={cardFinishClass(rewards.cosmetics.cardFinish)}
          tier={shown.tier}
          locked={shown.locked}
          lockLabel={c.lock}
          flipLabel={c.flip(tierName(shown.tier))}
          front={{ tierName: tierName(shown.tier), points: fmt(rewards.points.lifetime), pointsUnit: c.pts, name, progress: cardProgress(rewards, shown.tier), nextLine, rankLine: c.rank(tierRank(shown.tier)) }}
          back={{
            title: c.perksTitle(tierName(shown.tier)),
            perks: r.tiers[shown.tier].perks,
            footer: [rewards.founder ? c.founder(formatFounderNumber(rewards.founder.number)) : c.member(memberNumber(rewards.memberNumber)), since ? c.since(since) : ''],
          }}
        />
      </CardSpotlight>

      <HotStreakCard
        title={withBold(c.streak.title(streak.current), streak.current)}
        subtitle={c.streak.best(streak.best)}
        points={`+${fmt(streakPoints(streak.current))}`}
        pointsLabel={c.streak.pointsLabel}
        weeks={stripWeeks(streak.weeks)}
        stripLabel={c.streak.strip(counts.kept, counts.frozen, counts.missed)}
        footStart={streak.nextMultiplierAt ? withBold(c.streak.nextBonus(streak.nextMultiplierAt === 4 ? '1.5' : '2'), c.streak.weeks(streak.nextMultiplierAt)) : withBold(c.streak.topBonus, 'x2')}
        footEnd={withBold(c.streak.freezes(rewards.freezes.banked), rewards.freezes.banked)}
      />

      <InviteCta />

      <Section title={c.tiersTitle}>
        <TierLadder
          current={real}
          proLabel={c.pro}
          hereLabel={c.here}
          rows={rewards.tiers.map((tier) => ({ tier: tier.key, name: tierName(tier.key), description: r.tiers[tier.key].ladder, threshold: tier.requiresFounder ? c.founderWord : fmt(tier.minPoints) }))}
        />
        <Fine>{c.tiersFine}</Fine>
      </Section>

      <Section title={c.badgeTitle}>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { cap: c.placeProfile, lead: <AvatarBadge size="md" cornerTier={real} cornerTierLabel={r.tierLabel(tierName(real))}>{initials(name)}</AvatarBadge>, title: name, sub: tierName(real) },
            { cap: c.placeRow, lead: <TierBadge tier={real} size={28} />, title: c.title, sub: c.rowSub(tierName(real), tierRank(real)) },
          ].map((place) => (
            <div key={place.cap} className="grid content-start gap-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3">
              <span dir="auto" className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{place.cap}</span>
              <div className="flex min-w-0 items-center gap-2.5">
                {place.lead}
                <div dir="auto" className="min-w-0">
                  <b className="block break-words text-sm font-bold leading-tight text-[var(--color-brand-text-primary)]">{place.title}</b>
                  <small className="block text-[0.71875rem] text-[var(--color-brand-text-secondary)]">{place.sub}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={c.earnTitle}>
        <PointsList
          rows={rewards.earn.map((e) => ({
            label: e.key === 'week_kept' ? c.earn.week : e.key === 'budget_set' ? c.earn.budget : c.earn.month,
            hint: e.key === 'week_kept' ? (streak.multiplier > 1 ? c.earn.weekNow(String(streak.multiplier)) : c.earn.weekHint) : e.key === 'budget_set' ? c.earn.budgetHint : undefined,
            value: <span dir="ltr">{`+${e.points}`}</span>,
          }))}
        />
      </Section>

      <Section title={c.spendTitle}>
        <p dir="auto" className="-mt-1 text-xs text-[var(--color-brand-text-secondary)]">{c.balance(fmt(rewards.points.spendable))}</p>
        <MembershipPanel className="overflow-hidden">
          <div className={m.rows}>
            {rewards.shop.map((item) => {
              const state = shopRowState(item, rewards)
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={busy}
                  onClick={() => void press(item)}
                  data-shop={item.key}
                  data-state={state}
                  data-raw-button-ok="a shop row: the points list row, pressable as a whole"
                  className={cn(m.row, 'min-h-11 w-full bg-transparent text-start outline-none hover:bg-[var(--color-brand-elevated)] focus-visible:bg-[var(--color-brand-elevated)] disabled:opacity-60', state === 'unavailable' && 'opacity-60')}
                >
                  <span dir="auto" className={m.rowLabel}>{shopLabel(item)}{item.kind === 'repair' ? <small>{c.shop.repairHint}</small> : null}</span>
                  <b dir="auto" className={m.rowValue}>{state === 'owned' ? c.owned : state === 'in_use' ? c.inUse : c.cost(item.cost)}</b>
                </button>
              )
            })}
          </div>
        </MembershipPanel>
        {note ? <p role="status" dir="auto" className="text-center text-xs font-medium text-[var(--color-brand-text-primary)]">{note}</p> : null}
        <Fine>{c.spendFine}</Fine>
      </Section>
    </PageStack>
  )
}
