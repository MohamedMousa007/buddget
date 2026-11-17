'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { priceRegion } from '@/components/features/billing/planBilling'
import { MembershipHero } from '@/components/features/membership/MembershipHero'
import { MembershipPanel } from '@/components/features/membership/PointsList'
import { SparksPacks, packTotalSparks } from '@/components/features/membership/SparksPacks'
import { PageStack, Section, SectionTitle, Sub } from '@/components/features/rewards/pageParts'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { NoticeBanners } from '@/components/features/usage/NoticeHost'
import { packLists } from '@/components/features/usage/packList'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { billingOn, useBillingStore, type UsageWindow } from '@/lib/billing/billingStore'
import { PRO_PACK_BONUS } from '@/lib/billing/packBonus'
import { subscriptionView } from '@/lib/billing/subscriptionView'
import { useSparksPacks } from '@/lib/billing/useSparksPacks'
import { useLocale } from '@/lib/i18n'
import { useRewardsCopy } from '@/lib/i18n/rewardsCopy'
import { useUsageCopy } from '@/lib/i18n/usageCopy'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { featureShares } from '@/lib/usage/featureShares'
import { clock, weekdayDate } from '@/lib/usage/format'
import { cn } from '@/lib/utils'

function Meter({ label, window, foot }: { label: string; window: UsageWindow; foot: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(window.pct ?? 0)))
  return (
    <div className="grid gap-2 px-4 py-3.5">
      <div dir="auto" className="flex justify-between text-sm font-semibold text-[var(--member-fg)]">
        <span>{label}</span>
        <span dir="ltr" className="font-mono-numbers">{window.pct === null ? '—' : `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--member-cell)]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i className={cn('block h-full rounded-full', pct >= 80 ? 'bg-[var(--color-hero-stat-savings)]' : 'bg-[var(--member-mint)]')} style={{ width: `${pct}%` }} />
      </div>
      <span dir="auto" className="text-xs text-[var(--member-fg-2)]">{foot}</span>
    </div>
  )
}

function LimitRow({ label, value, mono, first }: { label: string; value: string; mono?: boolean; first?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-[13px] text-sm', !first && 'border-t border-[var(--color-brand-border)]')}>
      <span dir="auto" className="text-[var(--color-brand-text-secondary)]">{label}</span>
      <b dir={mono ? 'ltr' : 'auto'} className={cn('font-semibold text-[var(--color-brand-text-primary)]', mono && 'font-mono-numbers')}>{value}</b>
    </div>
  )
}

/** Usage: the two meters with their credit amounts, the Sparks wallet with the packs inline, where the week went, and the other limits. */
export default function UsagePage() {
  const copy = useUsageCopy()
  const u = useRewardsCopy().usage
  const { locale } = useLocale()
  const me = useBillingStore((s) => s.me)
  const refresh = useBillingStore((s) => s.refresh)
  const country = useFinanceStore((s) => s.profile.country)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const on = billingOn(me)
  const store = useSparksPacks(on)
  const [picked, setPicked] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    if (me && !on) navigate('/settings', { replace: true })
  }, [me, on])
  useEffect(() => { if (on) void refresh() }, [on, refresh])

  const products = me?.sparkProducts
  const storePacks = store.packs
  const lists = useMemo(
    () => packLists((products ?? []).map((p) => ({ ...p, countries: p.countries ?? null })), priceRegion(country, baseCurrency), store.available ? new Map(storePacks.map((p) => [p.id, p.price])) : null, u.packs.egypt),
    [products, country, baseCurrency, store.available, storePacks, u.packs.egypt],
  )
  const all = [...lists.main, ...lists.extra]
  const selected = all.find((p) => p.id === picked) ?? all.find((p) => p.id === lists.popularId) ?? null
  const selectedId = selected?.id ?? null
  const syncStore = store.setSelected
  // The store hook buys its own selection: keep it on the pack shown selected here.
  useEffect(() => { if (selectedId) syncStore(selectedId) }, [selectedId, syncStore])

  if (me && !on) return null
  const usage = me?.usage
  const view = subscriptionView(me)
  const paid = view.proActive
  const bonus = me?.rewards?.packBonusPercent ?? 0
  const shares = usage ? featureShares(usage.byFeature) : []

  const buy = async () => {
    setNote(null)
    if (!store.available || !storePacks.some((p) => p.id === selectedId)) return setNote(u.unavailable)
    await store.buy()
  }

  return (
    <SettingsSubPageShell title={copy.page.title} backHref="/settings/pro">
      {!me ? (
        <SkeletonList rows={4} />
      ) : !usage ? (
        <EmptyState title={copy.page.errorTitle} description={copy.page.errorBody} action={<Button size="touch" onClick={() => void refresh()}>{copy.actions.tryAgain}</Button>} />
      ) : (
        <PageStack>
          <NoticeBanners screen="usage" />
          <MembershipHero tone="pro" className="gap-3 rounded-[22px] p-4">
            <div dir="auto" className="flex items-center justify-between gap-2 font-bold">
              <span>{view.kind === 'trial' ? u.trial : paid ? u.pro : u.freePlan}</span>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--member-cell)] px-2.5 py-1 text-[0.71875rem] font-bold">{paid ? u.pillPro : u.pillFree(Math.round(usage.week.pct ?? 0))}</span>
            </div>
            <div className="divide-y divide-[var(--member-line)] rounded-[20px] border border-[var(--member-line)] bg-black/40">
              <Meter label={u.session} window={usage.session} foot={usage.session.pct !== null && usage.session.pct >= 100 && !usage.session.resetAt ? copy.meter.reached : u.refillsAt(clock(usage.session.resetAt, locale) || '—', usage.session.limit ?? 0)} />
              <Meter label={u.week} window={usage.week} foot={u.refillsOn(weekdayDate(usage.week.resetAt, locale) || '—', usage.week.limit ?? 0)} />
            </div>
          </MembershipHero>

          <MembershipPanel className="grid gap-3.5 p-4">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="grid size-[34px] shrink-0 place-items-center rounded-[11px] bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]"><Sparkles className="size-[18px]" aria-hidden /></span>
                <div><SectionTitle>{u.sparks}</SectionTitle><Sub>{u.sparksSub}</Sub></div>
              </div>
              <b dir="ltr" className="font-mono-numbers text-[2rem] font-semibold text-[var(--color-brand-text-primary)]">{usage.sparksLeft}</b>
            </div>
            {selected ? (
              <SparksPacks
                packs={lists.main}
                extraPacks={lists.extra}
                selected={selected.id}
                onSelect={(id) => { setPicked(id); setNote(null) }}
                popularId={lists.popularId}
                bonusPercent={bonus}
                copy={u.packs}
                disabled={store.busy}
                cta={{ label: u.get(packTotalSparks(selected, bonus)), onClick: () => void buy(), loading: store.busy }}
                upsell={bonus > 0 ? undefined : { text: u.withPro(packTotalSparks(selected, PRO_PACK_BONUS)), actionLabel: u.seePro, onAction: () => navigate('/settings/pro') }}
                finePrint={bonus > 0 ? u.packsFine(bonus) : undefined}
              />
            ) : null}
            {note ? <p role="status" dir="auto" className="text-center text-xs text-[var(--color-brand-text-secondary)]">{note}</p> : null}
          </MembershipPanel>

          <Section title={u.wentTitle}>
            <MembershipPanel className="overflow-hidden">
              {shares.map((row, i) => <LimitRow key={row.key} first={i === 0} label={u.features[row.key]} value={`${row.pct}%`} mono />)}
              <div className={cn('flex items-center justify-between gap-3 bg-[var(--color-brand-green-soft)] px-4 py-[13px] text-sm', shares.length > 0 && 'border-t border-[var(--color-brand-border)]')}>
                <span dir="auto" className="text-[var(--color-brand-text-secondary)]">{u.sms}</span>
                <b dir="auto" className="font-semibold text-[var(--color-brand-green)]">{u.never}</b>
              </div>
            </MembershipPanel>
          </Section>

          <Section title={u.otherTitle}>
            <MembershipPanel>
              <LimitRow first label={u.views} value={usage.balanceViews.limit === null ? u.unlimited : u.of(usage.balanceViews.used, usage.balanceViews.limit)} mono={usage.balanceViews.limit !== null} />
              <LimitRow label={u.plans} value={usage.plans.limit === null ? u.unlimited : u.of(usage.plans.used, usage.plans.limit)} mono={usage.plans.limit !== null} />
              <LimitRow label={u.advisor} value={usage.advisor.entitled ? u.included : u.freeThisMonth(usage.advisor.free_left)} />
            </MembershipPanel>
            {paid ? null : <Button size="touch" variant="outline" className="w-full font-semibold" onClick={() => navigate('/settings/pro')}>{u.removeLimits}</Button>}
          </Section>
        </PageStack>
      )}
    </SettingsSubPageShell>
  )
}
