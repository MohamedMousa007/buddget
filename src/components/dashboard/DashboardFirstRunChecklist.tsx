'use client'

import { useEffect, useRef } from 'react'
import { ArrowRight, Check, Wallet, Target, AlertCircle, CreditCard, Lock, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useActionToast } from '@/components/ui/ActionToast'
import { ONBOARDING_EVENTS, track } from '@/lib/analytics/events'
import type { FirstRunChecklistItem, FirstRunChecklistSnapshot } from '@/lib/onboarding/firstRunChecklist'

export interface DashboardFirstRunChecklistProps {
  snapshot: FirstRunChecklistSnapshot
}

type Item = FirstRunChecklistItem

/**
 * First-run progress card: 4 rows that open the relevant input sheet or page.
 * Each row stays tappable even after `done` flips true — users can add more
 * income sources, payment methods, etc. without leaving the dashboard.
 * Powered by the shared `useFirstRunChecklist` hook so the banner on non-
 * dashboard pages shows identical progress.
 */
export function DashboardFirstRunChecklist({ snapshot }: DashboardFirstRunChecklistProps) {
  const t = useT()
  const router = useRouter()
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const updateProfile = useFinanceStore((s) => s.updateProfile)
  const showToast = useActionToast()

  const { items, doneCount, totalCount } = snapshot
  const progressPct = Math.round((doneCount / totalCount) * 100)

  // Count-delta watcher: toast "X added" once per increment so users get
  // explicit confirmation that their entry landed — addresses the perceived
  // "data vanished" bug when the card flips to done + grey.
  const prevCountsRef = useRef<Partial<Record<Item['id'], number>>>({})
  useEffect(() => {
    const prev = prevCountsRef.current
    for (const item of items) {
      const prior = prev[item.id]
      if (prior !== undefined && item.count > prior) {
        const toastMsg = toastTextFor(item.id, t)
        if (toastMsg) {
          try {
            showToast(toastMsg)
          } catch {
            /* toast provider not mounted in tests */
          }
        }
        track(ONBOARDING_EVENTS.checklistItemCompleted, { id: item.id, count: item.count })
      }
      prev[item.id] = item.count
    }
  }, [items, showToast, t])

  const handleRowClick = (item: Item) => {
    if (!item.enabled) return
    if (item.id === 'income') {
      setActiveModal('addIncome')
      return
    }
    if (item.id === 'budget') {
      router.push('/budget-setup')
      return
    }
    if (item.id === 'debts') {
      setActiveModal('addDebt')
      return
    }
    if (item.id === 'payments') {
      setActiveModal('addPaymentMethod')
    }
  }

  const handleOptOut = (item: Item) => {
    if (item.id === 'debts') {
      updateProfile({ noDebtsDeclared: true })
      track(ONBOARDING_EVENTS.checklistItemCompleted, { id: 'debts', via: 'opt_out' })
    }
  }

  const handleHide = () => {
    updateSettings({ onboardingChecklistHidden: true })
    track(ONBOARDING_EVENTS.checklistHidden)
  }

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {t.onboarding.checklistTitle}
          </h2>
          <p className="text-[11px] text-[var(--color-brand-text-muted)]">
            {t.onboarding.checklistProgress(doneCount, totalCount)}
          </p>
        </div>
        <div className="w-20 h-1.5 rounded-full bg-[var(--color-brand-elevated)] overflow-hidden shrink-0">
          <div
            className="h-full bg-[var(--color-brand-red)] transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            label={labelFor(item.id, t)}
            disabledLabel={
              item.id === 'budget' ? t.onboarding.checklistDisabledBudget : null
            }
            optOutLabel={
              item.id === 'debts' ? t.onboarding.checklistOptOutDebts : null
            }
            addMoreLabel={t.onboarding.checklistTapToAddMore}
            addedLabel={t.onboarding.checklistAddedAgain(item.count)}
            onClick={() => handleRowClick(item)}
            onOptOut={item.hasOptOut && !item.done ? () => handleOptOut(item) : null}
          />
        ))}
      </ul>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-[var(--color-brand-text-muted)]">
          {t.onboarding.checklistEmptyHint}
        </p>
        <button
          type="button"
          onClick={handleHide}
          className="text-[11px] text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]"
        >
          {t.onboarding.checklistHideCta}
        </button>
      </div>
    </section>
  )
}

function labelFor(id: Item['id'], t: ReturnType<typeof useT>): string {
  if (id === 'income') return t.onboarding.checklistItemIncome
  if (id === 'budget') return t.onboarding.checklistItemBudget
  if (id === 'debts') return t.onboarding.checklistItemDebts
  return t.onboarding.checklistItemPayments
}

function toastTextFor(id: Item['id'], t: ReturnType<typeof useT>): string | null {
  if (id === 'income') return t.common.toastIncomeAdded
  if (id === 'debts') return t.common.toastDebtAdded
  if (id === 'payments') return t.onboarding.toastPaymentAdded
  // budget is a one-shot; no toast needed (plan-applied flow toasts itself).
  return null
}

function ChecklistRow({
  item,
  label,
  disabledLabel,
  optOutLabel,
  addMoreLabel,
  addedLabel,
  onClick,
  onOptOut,
}: {
  item: Item
  label: string
  disabledLabel: string | null
  optOutLabel: string | null
  addMoreLabel: string
  addedLabel: string
  onClick: () => void
  onOptOut: (() => void) | null
}) {
  const icon = item.id
  const locked = !item.enabled && !item.done
  const done = item.done
  // Keep done rows tappable so a user can add a 2nd income source, another
  // payment method, more debts, etc. without leaving the dashboard. Only
  // locked-by-prereq rows stay disabled.
  const showSubtext = done && !locked

  return (
    <li
      className={
        'flex items-center gap-3 rounded-xl border px-3 min-h-11 transition-colors ' +
        (locked
          ? 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 opacity-60'
          : done
            ? 'border-[var(--color-brand-green)]/40 bg-[var(--color-brand-green)]/5 hover:bg-[var(--color-brand-green)]/10'
            : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] hover:bg-[var(--color-brand-card)]')
      }
    >
      <button
        type="button"
        onClick={onClick}
        disabled={locked}
        className="flex-1 flex items-center gap-3 text-start py-2 disabled:cursor-default"
        title={locked ? disabledLabel ?? '' : ''}
      >
        <span className="w-6 h-6 flex items-center justify-center shrink-0">
          {locked ? (
            <Lock className="w-4 h-4 text-[var(--color-brand-text-muted)]" aria-hidden />
          ) : done ? (
            <Check className="w-4 h-4 text-[var(--color-brand-green)]" aria-hidden />
          ) : icon === 'income' ? (
            <Wallet className="w-4 h-4 text-[var(--color-brand-text-secondary)]" aria-hidden />
          ) : icon === 'budget' ? (
            <Target className="w-4 h-4 text-[var(--color-brand-text-secondary)]" aria-hidden />
          ) : icon === 'debts' ? (
            <AlertCircle className="w-4 h-4 text-[var(--color-brand-text-secondary)]" aria-hidden />
          ) : (
            <CreditCard className="w-4 h-4 text-[var(--color-brand-text-secondary)]" aria-hidden />
          )}
        </span>

        <span className="flex-1 min-w-0">
          <span
            className={
              'block text-sm ' +
              (done
                ? 'line-through text-[var(--color-brand-text-muted)]'
                : 'text-[var(--color-brand-text-primary)]')
            }
          >
            {label}
          </span>
          {showSubtext ? (
            <span className="block text-[10px] text-[var(--color-brand-text-muted)] leading-tight mt-0.5">
              {item.count > 0 ? `${addedLabel} · ${addMoreLabel}` : addMoreLabel}
            </span>
          ) : null}
        </span>

        {!done && !locked ? (
          <ArrowRight className="w-4 h-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
        ) : done && !locked ? (
          <Plus className="w-4 h-4 text-[var(--color-brand-green)]/70" aria-hidden />
        ) : null}
      </button>
      {onOptOut && optOutLabel ? (
        <button
          type="button"
          onClick={onOptOut}
          className="text-[11px] text-[var(--color-brand-red)] hover:underline shrink-0"
        >
          {optOutLabel}
        </button>
      ) : null}
    </li>
  )
}
