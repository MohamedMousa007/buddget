'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { AlertTriangle, CalendarClock, Crown, Info, Sparkles } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { SparksPackPicker } from '@/components/features/usage/SparksPackPicker'
import { UsageMeter } from '@/components/features/usage/UsageMeter'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { PromptBanner } from '@/components/ui/PromptBanner'
import { useActionToast } from '@/components/ui/ActionToast'
import { apiFetchAuth } from '@/lib/apiBase'
import { useBillingStore } from '@/lib/billing/billingStore'
import { openManageSubscription, purchasesAvailable } from '@/lib/billing/purchases'
import { usePlanPurchase } from '@/lib/billing/usePlanPurchase'
import { useSparksPacks } from '@/lib/billing/useSparksPacks'
import { useLocale, useT } from '@/lib/i18n'
import { useUsageCopy, type NoticeData } from '@/lib/i18n/usageCopy'
import { navigate } from '@/lib/navigation/navigate'
import { useNavPath } from '@/lib/navigation/navStore'
import { PROMPT_PRIORITY, useRegisterPrompts, type Prompt } from '@/lib/store/usePromptStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { settlePrompt, settledKeys } from '@/lib/prompts/settle'
import { noticeData, weekdayDate } from '@/lib/usage/format'
import { useNoticeState } from '@/lib/usage/useNoticeState'
import { MONEY_ENTRY_MODALS, useUsageStore } from '@/lib/usage/usageStore'
import { byPriority, usageNotices, visibleNotices, type Notice, type NoticeScreen, type NoticeState } from '@/lib/usage/usageNotices'

/** Where a path sits for the rules table. */
export function screenOf(path: string): NoticeScreen {
  if (path.startsWith('/settings/pro/usage')) return 'usage'
  if (path.startsWith('/settings/pro')) return 'pro'
  if (path.startsWith('/settings')) return 'settings'
  if (path.startsWith('/budget')) return 'plans'
  if (path.startsWith('/accounts')) return 'balance'
  if (path === '/' || path.startsWith('/flow')) return 'flow'
  return 'other'
}

const SNOOZE_DAYS = 7

/** The data a notice's words need: reset times as clock times and dates, never countdowns. */
function dataFor(state: NoticeState, locale: string, dateAt: string | null): NoticeData {
  return noticeData({
    sessionResetAt: state.session.resetAt,
    weekResetAt: state.week.resetAt,
    dateAt,
    n: state.plans.readOnly || Math.max(0, (state.balanceViews.limit ?? 0) - state.balanceViews.used),
    sparks: state.sparksLeft,
  }, locale)
}

/** What a notice's button does. */
function useActions(screen?: NoticeScreen) {
  const copy = useUsageCopy().actions
  const setPacksOpen = useUsageStore((s) => s.setPacksOpen)
  return useCallback((n: Notice): Array<{ label: string; onPress: () => void }> => {
    if (screen === 'usage' && (n.key === 'session80' || n.key === 'week80')) return []
    const go = (path: string) => () => navigate(path)
    switch (n.key) {
      case 'session80': case 'week80': return [{ label: copy.seeUsage, onPress: go('/settings/pro/usage') }]
      case 'sparks_low': return [{ label: copy.getSparks, onPress: () => setPacksOpen(true) }]
      case 'grace': return [{ label: copy.updatePayment, onPress: () => void openManageSubscription() }]
      case 'cancelled': return [{ label: copy.keepPro, onPress: () => void openManageSubscription() }]
      case 'plans_ro': return [{ label: copy.seePro, onPress: go('/settings/pro') }]
      case 'trial.d3': return [{ label: copy.askAdvisor, onPress: () => useSettingsStore.getState().setActiveModal('aiChat') }]
      case 'trial.d10': return [{ label: copy.scanReceipt, onPress: () => useSettingsStore.getState().setActiveModal('scanReceipt') }]
      case 'trial.d23': case 'trial.d28': return [{ label: copy.seePlans, onPress: go('/settings/pro') }]
      case 'trial.d37': return [{ label: copy.seePro, onPress: go('/settings/pro') }]
      case 'expired': return [{ label: copy.rejoin, onPress: go('/settings/pro') }]
      default: return []
    }
  }, [copy, setPacksOpen, screen])
}

function useSnooze() {
  const { snoozed, snoozeBanner } = useSettingsStore(useShallow((s) => ({ snoozed: s.snoozedBanners, snoozeBanner: s.snoozeBanner })))
  const snooze = useCallback((key: string) => snoozeBanner(`usage:${key}`, new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString()), [snoozeBanner])
  return { snoozed, snooze }
}

const noticeDate = (s: { me: { subscription?: { graceEndsAt: string | null; renewsAt: string | null } | null; trialEndsAt: string | null } | null }) =>
  s.me?.subscription?.graceEndsAt ?? s.me?.subscription?.renewsAt ?? s.me?.trialEndsAt ?? null

/** The inline banners a screen shows, from the same rules table. One banner is three lines at most; ✕ snoozes it for a week. */
export function NoticeBanners({ screen, className }: { screen: NoticeScreen; className?: string }) {
  const state = useNoticeState()
  const { locale } = useLocale()
  const copy = useUsageCopy()
  const actions = useActions(screen)
  const { snoozed, snooze } = useSnooze()
  const end = useBillingStore(noticeDate)
  const shown = useMemo(() => {
    if (!state) return []
    const all = usageNotices(state, { screen }).filter((n) => n.surface === 'banner')
    return visibleNotices(all, { snoozed, settled: [], shownThisSession: new Set() }, state.now).sort(byPriority)
  }, [state, screen, snoozed])
  if (!state || shown.length === 0) return null
  const d = dataFor(state, locale, end)
  return (
    <div className={className ?? 'flex flex-col gap-2'}>
      {shown.map((n) => {
        const entry = copy.notices[n.key]
        const [first] = actions(n)
        return (
          <PromptBanner
            key={n.key}
            tone={n.tone === 'negative' ? 'negative' : n.tone === 'warning' ? 'warning' : 'brand'}
            icon={n.tone === 'negative' || n.tone === 'warning' ? <AlertTriangle className="size-[18px]" aria-hidden /> : <Info className="size-[18px]" aria-hidden />}
            title={entry.title(d)}
            description={entry.body?.(d)}
            confirmLabel={first?.label ?? copy.actions.dismiss}
            onConfirm={first?.onPress ?? (() => snooze(n.key))}
            {...(n.snoozable ? { dismissLabel: copy.actions.later, onDismiss: () => snooze(n.key) } : {})}
          />
        )
      })}
    </div>
  )
}

/** The Flow stack cards (trial steps, expired), registered into the existing prompt stack. */
function useStackCards(state: NoticeState | null, end: string | null) {
  const { locale } = useLocale()
  const copy = useUsageCopy()
  const actions = useActions()
  const promptState = useFinanceStore((s) => s.settings.promptState)
  const prompts = useMemo<Prompt[]>(() => {
    if (!state) return []
    const settled = settledKeys(promptState)
    const d = dataFor(state, locale, end)
    return visibleNotices(usageNotices(state, { screen: 'flow' }).filter((n) => n.surface === 'stack'), { snoozed: {}, settled, shownThisSession: new Set() }, state.now).map((n) => {
      const [a] = actions(n)
      const entry = copy.notices[n.key]
      return {
        key: `usage:${n.key}`,
        priority: PROMPT_PRIORITY.planChange + 5,
        tone: 'brand' as const,
        icon: n.key.startsWith('trial') ? CalendarClock : Crown,
        title: entry.title(d),
        description: entry.body?.(d),
        actions: a ? [{ label: a.label, variant: 'default' as const, onPress: () => { settlePrompt(`usage:${n.key}`); a.onPress() } }] : [],
      }
    })
  }, [state, locale, end, copy, actions, promptState])
  useRegisterPrompts('usage-notices', prompts)
}

/** The one limit sheet: icon, title, one sentence, the meters, and what to do about it. Pro and trial see Sparks only; a plan or balance limit sees Pro only. */
function LimitSheet({ notice, state, onClose }: { notice: Notice; state: NoticeState; onClose: () => void }) {
  const { locale } = useLocale()
  const copy = useUsageCopy()
  const t = useT().billing
  const view = useUsageStore((s) => s.packsOpen)
  const setPacksOpen = useUsageStore((s) => s.setPacksOpen)
  const billing = usePlanPurchase(notice.offers.includes('pro'), t)
  const packs = useSparksPacks(view)
  const end = useBillingStore((s) => s.me?.subscription?.renewsAt ?? null)
  const d = dataFor(state, locale, state.billing.cancelledEndsAt ?? end ?? state.session.resetAt)
  const entry = copy.notices[notice.key]
  const paid = state.plan === 'pro' || state.plan === 'trial'
  const yearly = billing.options.find((o) => o.kind === 'annual')
  const first = notice.key === 'session_block_first'
  const showMeters = notice.offers.includes('sparks') || notice.key === 'week_block'
  const dateLine = (iso: string | null) => (iso ? weekdayDate(iso, locale) : '')
  const picked = packs.packs.find((p) => p.id === packs.selected)

  if (view) {
    return (
      <ModalShell open onBackdropClick={packs.busy ? () => {} : () => setPacksOpen(false)} scrollChild>
        <div className="flex min-h-0 flex-1 flex-col">
          <V3SheetHeader onClose={packs.busy ? () => {} : () => setPacksOpen(false)}>
            <V3SheetHeader.Title>{copy.sheet.sparksHead}</V3SheetHeader.Title>
            <V3SheetHeader.Subtitle>{copy.page.sparksNote}</V3SheetHeader.Subtitle>
          </V3SheetHeader>
          <SheetBody className="space-y-3 pt-1">
            {!packs.available || packs.packs.length === 0 ? (
              <p role="status" dir="auto" className="text-sm text-[var(--color-brand-text-secondary)]">{packs.available && packs.loading ? t.loading : copy.packs.unavailable}</p>
            ) : (
              <SparksPackPicker packs={packs.packs} selected={packs.selected} onSelect={packs.setSelected} pro={paid} disabled={packs.busy} />
            )}
          </SheetBody>
          <SheetFooter safeArea>
            <Button size="cta-block" loading={packs.busy} disabled={!picked} onClick={() => void packs.buy().then((ok) => ok && setPacksOpen(false))} className="font-semibold">
              {picked ? copy.packs.buy(paid ? picked.sparks + Math.floor(picked.sparks * 0.25) : picked.sparks, picked.price) : copy.sheet.sparksHead}
            </Button>
            <Button size="touch" variant="ghost" disabled={packs.busy} onClick={() => void packs.restore()} className="w-full text-[var(--color-brand-text-muted)]">{t.restore}</Button>
          </SheetFooter>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell open onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{entry.title(d)}</V3SheetHeader.Title>
          {entry.body ? <V3SheetHeader.Subtitle>{entry.body(d)}</V3SheetHeader.Subtitle> : null}
        </V3SheetHeader>
        <SheetBody className="space-y-4 pt-1">
          {showMeters && state.session.pct !== null ? (
            <UsageMeter label={copy.meter.session} pct={state.session.pct} value={copy.meter.pct(Math.round(state.session.pct))} note={state.session.pct >= 100 ? copy.meter.reached : copy.meter.resets(dateLine(state.session.resetAt))} />
          ) : null}
          {showMeters && state.week.pct !== null ? (
            <UsageMeter label={copy.meter.week} pct={state.week.pct} value={copy.meter.pct(Math.round(state.week.pct))} note={state.week.pct >= 100 ? copy.meter.reached : copy.meter.resets(dateLine(state.week.resetAt))} />
          ) : null}
          {notice.key === 'views10' && state.balanceViews.limit !== null ? (
            <UsageMeter kind="count" label={copy.meter.viewsLabel} used={state.balanceViews.used} limit={state.balanceViews.limit} value={copy.meter.viewsOf(state.balanceViews.used, state.balanceViews.limit)} />
          ) : null}
          {first ? (
            <div dir="auto" className="rounded-[14px] bg-[var(--color-brand-elevated)] px-3.5 py-3">
              <p className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{copy.sheet.howTitle}</p>
              <p className="mt-1 text-[0.78125rem] leading-snug text-[var(--color-brand-text-secondary)]">{copy.sheet.howBody}</p>
            </div>
          ) : null}
          <div className={notice.offers.length === 2 ? 'grid grid-cols-2 gap-2.5' : 'grid grid-cols-1 gap-2.5'}>
            {notice.offers.includes('sparks') ? (
              <div className="flex min-w-0 flex-col gap-1.5 rounded-[20px] border-[1.5px] border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-soft)] p-3">
                <span dir="auto" className="inline-flex items-center gap-2 text-[0.9375rem] font-extrabold text-[var(--color-brand-primary-ink)]"><Sparkles className="size-4" aria-hidden />{copy.sheet.sparksHead}</span>
                <span dir="auto" className="text-base font-extrabold leading-tight text-[var(--color-brand-text-primary)]">{copy.sheet.sparksTitle}</span>
                <ul dir="auto" className="flex flex-col gap-1 text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{copy.sheet.sparksLines.map((l) => <li key={l}>{l}</li>)}</ul>
                {paid ? <span dir="auto" className="text-xs font-semibold text-[var(--color-brand-primary-ink)]">{copy.sheet.plusBonus}</span> : null}
                <Button size="touch" className="mt-auto w-full font-semibold" onClick={() => setPacksOpen(true)}>{copy.actions.getSparks}</Button>
              </div>
            ) : null}
            {notice.offers.includes('pro') ? (
              <div className="flex min-w-0 flex-col gap-1.5 rounded-[20px] bg-[image:var(--member-aurora)] p-3 text-[var(--member-fg)]">
                <span dir="auto" className="inline-flex items-center gap-2 text-[0.9375rem] font-extrabold"><Crown className="size-4" aria-hidden />{copy.sheet.proHead}</span>
                <span dir="auto" className="text-base font-extrabold leading-tight">{copy.sheet.proTitle}</span>
                {yearly ? <span dir="auto" className="text-[0.8125rem] font-semibold"><span dir="ltr" className="font-mono-numbers">{copy.sheet.proPrice(yearly.price)}</span>{yearly.perMonth ? ` · ${copy.sheet.proPerMonth(yearly.perMonth)}` : ''}</span> : null}
                <ul dir="auto" className="flex flex-col gap-1 text-[0.78125rem] text-[var(--member-fg-2)]">{copy.sheet.proLines.map((l) => <li key={l}>{l}</li>)}</ul>
                <Button size="touch" variant="secondary" className="mt-auto w-full font-semibold" onClick={() => { onClose(); navigate('/settings/pro') }}>{copy.actions.goPro}</Button>
              </div>
            ) : null}
          </div>
        </SheetBody>
        <SheetFooter safeArea>
          <Button size="touch" variant="ghost" className="w-full font-semibold text-[var(--color-brand-text-secondary)]" onClick={onClose}>{copy.actions.notNow}</Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}

/**
 * The one presenter for every notice (monetization plan v9): it reads the rules table and draws the result on the existing surfaces,
 * an action toast, one limit sheet (replacing the paywall sheet) and cards in the Flow prompt stack; inline banners are drawn where a
 * screen mounts `NoticeBanners`. A notice waits while money is being entered; a sheet shows once per notice per session.
 */
export function NoticeHost() {
  const state = useNoticeState()
  const { locale } = useLocale()
  const copy = useUsageCopy()
  const toast = useActionToast()
  const path = useNavPath()
  const activeModal = useSettingsStore((s) => s.activeModal)
  const events = useUsageStore((s) => s.events)
  const packsOpen = useUsageStore((s) => s.packsOpen)
  const sheet = useUsageStore((s) => s.sheet)
  const setSheet = useUsageStore((s) => s.setSheet)
  const end = useBillingStore(noticeDate)
  const holding = activeModal !== null && MONEY_ENTRY_MODALS.has(activeModal)
  const screen = screenOf(path)

  useStackCards(state, end)

  // Staff resets and "your limit is back" are toasts of their own when the person opens the app.
  useEffect(() => {
    if (!state || holding) return
    const standing = visibleNotices(usageNotices(state, { screen }).filter((n) => n.surface === 'toast'), { snoozed: {}, settled: settledKeys(useFinanceStore.getState().settings.promptState), shownThisSession: new Set(useUsageStore.getState().shown) }, state.now)
    for (const n of standing) {
      useUsageStore.getState().markShown(`usage:${n.key}`)
      toast(copy.notices[n.key].title(dataFor(state, locale, end)))
      if (n.key === 'reset_granted') void apiFetchAuth('/api/entitlements/seen-resets', { method: 'POST' }).catch(() => undefined)
      if (n.key === 'reset_back') {
        settlePrompt('usage:reset_back')
        useUsageStore.getState().setSignal('lastLimit', null)
      }
    }
  }, [state, holding, screen, toast, copy, locale, end])

  // Events: a limit, a purchase result. One at a time, never during money entry.
  useEffect(() => {
    if (!state || holding || sheet || events.length === 0) return
    const event = useUsageStore.getState().take()
    if (!event) return
    const both = event.type === 'limit' && (state.session.pct ?? 0) >= 100 && (state.week.pct ?? 0) >= 100
    const resolved = both ? ({ type: 'limit', layer: 'both' } as const) : event
    const shownSet = new Set(useUsageStore.getState().shown)
    const notices = visibleNotices(usageNotices(state, { screen, event: resolved }), { snoozed: {}, settled: settledKeys(useFinanceStore.getState().settings.promptState), shownThisSession: shownSet }, state.now).sort(byPriority)
    for (const n of notices) {
      if (n.surface === 'toast') toast(copy.notices[n.key].title(dataFor(state, locale, end)))
      else if (n.surface === 'sheet' && !sheet) {
        useUsageStore.getState().markShown(`usage:${n.key}`)
        if (n.key === 'session_block_first') useUsageStore.getState().setSignal('firstLimitSeen', true)
        setSheet(n)
      }
    }
  }, [state, events, holding, sheet, screen, toast, copy, locale, end])

  if (!state) return null
  if (sheet) return <LimitSheet notice={sheet} state={state} onClose={() => { setSheet(null); useUsageStore.getState().setPacksOpen(false) }} />
  // The pack picker opened on its own (the Usage page, a low-Sparks banner): the same sheet, in its packs view.
  if (packsOpen && purchasesAvailable()) {
    const packsOnly: Notice = { key: 'sparks_low', severity: 'warning', surface: 'sheet', tone: 'warning', offers: ['sparks'], snoozable: false, oncePerSession: false, once: false }
    return <LimitSheet notice={packsOnly} state={state} onClose={() => useUsageStore.getState().setPacksOpen(false)} />
  }
  return null
}
