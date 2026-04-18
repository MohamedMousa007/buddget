'use client'

import { ArrowRight, Check, Wallet, Target, AlertCircle, CreditCard, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { ONBOARDING_EVENTS, track } from '@/lib/analytics/events'
import type { FirstRunChecklistItem, FirstRunChecklistSnapshot } from '@/lib/onboarding/firstRunChecklist'

export interface DashboardFirstRunChecklistProps {
  snapshot: FirstRunChecklistSnapshot
}

type Item = FirstRunChecklistItem

/**
 * First-run progress card: 4 tappable rows that open the relevant input sheet
 * or page. Fed by the shared `useFirstRunChecklist` hook so the banner on
 * non-dashboard pages shows identical progress.
 */
export function DashboardFirstRunChecklist({ snapshot }: DashboardFirstRunChecklistProps) {
  const t = useT()
  const router = useRouter()
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const updateSettings = useFinanceStore((s) => s.updateSettings)
  const updateProfile = useFinanceStore((s) => s.updateProfile)

  const { items, doneCount, totalCount } = snapshot
  const progressPct = Math.round((doneCount / totalCount) * 100)

  const handleRowClick = (item: Item) => {
    if (!item.enabled || item.done) return
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

function ChecklistRow({
  item,
  label,
  disabledLabel,
  optOutLabel,
  onClick,
  onOptOut,
}: {
  item: Item
  label: string
  disabledLabel: string | null
  optOutLabel: string | null
  onClick: () => void
  onOptOut: (() => void) | null
}) {
  const icon = item.id
  const locked = !item.enabled && !item.done
  const done = item.done
  return (
    <li
      className={
        'flex items-center gap-3 rounded-xl border px-3 min-h-11 transition-colors ' +
        (done
          ? 'border-[var(--color-brand-green)]/40 bg-[var(--color-brand-green)]/5'
          : locked
            ? 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 opacity-60'
            : 'border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] hover:bg-[var(--color-brand-card)]')
      }
    >
      <button
        type="button"
        onClick={onClick}
        disabled={locked || done}
        className="flex-1 flex items-center gap-3 text-start py-2 disabled:cursor-default"
        title={locked ? disabledLabel ?? '' : ''}
      >
        <span className="w-6 h-6 flex items-center justify-center shrink-0">
          {done ? (
            <Check className="w-4 h-4 text-[var(--color-brand-green)]" aria-hidden />
          ) : locked ? (
            <Lock className="w-4 h-4 text-[var(--color-brand-text-muted)]" aria-hidden />
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
        <span
          className={
            'text-sm ' +
            (done
              ? 'line-through text-[var(--color-brand-text-muted)]'
              : 'text-[var(--color-brand-text-primary)]')
          }
        >
          {label}
        </span>
        {!done && !locked ? (
          <ArrowRight className="ms-auto w-4 h-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
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

