'use client'

import { selectActivePlan } from '@/lib/budget/activePlan'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Minus, Plus, ShieldCheck } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deriveSimpleMonth, simpleMonthDebts } from '@/lib/savings/simpleMonth'
import { computeEmergencyFund } from '@/lib/savings/emergencyFund'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SimpleMonthSheet } from '@/components/features/savings-v3/SimpleMonthSheet'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import type { EmergencyFundConfig } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'

export interface EmergencyFundSheetProps {
  open: boolean
  onClose: () => void
  /** Kept for callers; the sheet is one view now (the fund, editable in place). */
  mode?: 'details' | 'edit'
  /** "Add money". The page opens its add sheet; the fund sheet closes. */
  onAddMoney?: () => void
}

const MIN_MONTHS = 1
const MAX_MONTHS = 24
const clampMonths = (m: number) => Math.max(MIN_MONTHS, Math.min(MAX_MONTHS, m))

/** The emergency fund: months covered against a target, the months to cover (typed or − / +), and a simple month. */
export function EmergencyFundSheet({ open, onClose, onAddMoney }: EmergencyFundSheetProps) {
  const t = useT().wealthSheets.ef
  const c = useGoalsLtCopy().ef
  const { budgetPlans, activeBudgetPlanId, debts, profile, settings, exchangeRates, savingsAccounts, goldPricePerGram, goldPriceAvailable, updateProfile } = useFinanceStore(
    useShallow((s) => ({
      budgetPlans: s.budgetPlans, activeBudgetPlanId: s.activeBudgetPlanId,
      debts: s.debts, profile: s.profile, settings: s.settings, exchangeRates: s.exchangeRates,
      savingsAccounts: s.savingsAccounts, goldPricePerGram: s.goldPricePerGram, goldPriceAvailable: s.goldPriceAvailable,
      updateProfile: s.updateProfile,
    })),
  )

  const cfg = profile.emergencyFundConfig ?? undefined
  const currency = settings.baseCurrency
  const [targetMonths, setTargetMonths] = useState(cfg?.targetMonths ?? 3)
  const [monthsDraft, setMonthsDraft] = useState(String(cfg?.targetMonths ?? 3))
  const [monthOpen, setMonthOpen] = useState(false)

  const activePlan = selectActivePlan(budgetPlans, activeBudgetPlanId) ?? undefined
  const derived = useMemo(
    () => deriveSimpleMonth({ profile, activePlan, debts, baseCurrency: currency, exchangeRates }),
    [profile, activePlan, debts, currency, exchangeRates],
  )
  const debtsLine = useMemo(
    () => simpleMonthDebts(debts, currency, exchangeRates).map((d) => `${d.name} ${fmtNum(d.amount)}`).join(' · '),
    [debts, currency, exchangeRates],
  )
  // The user's figure (or the sum they chose in the breakdown) wins; with none yet, the derived simple month.
  const essentials = cfg?.monthlyEssentials && cfg.monthlyEssentials > 0 ? cfg.monthlyEssentials : derived.total

  const goldOk = goldPriceAvailable !== false
  const cover = useMemo(() => {
    const pockets = savingsAccounts.filter((a) => a.category === 'savings')
    const ids = cfg?.coverPocketIds ?? pockets.map((a) => a.id)
    return pockets
      .filter((a) => ids.includes(a.id))
      .reduce((s, a) => s + (savingsAccountBalanceInBase(a, currency, exchangeRates, goldPricePerGram, goldOk) ?? 0), 0)
  }, [savingsAccounts, cfg?.coverPocketIds, currency, exchangeRates, goldPricePerGram, goldOk])
  const fund = computeEmergencyFund({ coverAmount: cover, monthlyEssentials: essentials, targetMonths })
  const target = essentials * targetMonths
  const pct = target > 0 ? Math.min(100, (cover / target) * 100) : 0

  // Cover is your whole liquid savings, so no per-pocket list is written.
  const save = (months: number, monthlyEssentials: number) => {
    const next: EmergencyFundConfig = { targetMonths: months, monthlyEssentials: monthlyEssentials > 0 ? monthlyEssentials : undefined }
    updateProfile({ emergencyFundConfig: next })
  }
  const setMonths = (m: number) => {
    const v = clampMonths(m)
    setTargetMonths(v)
    setMonthsDraft(String(v))
    save(v, essentials)
  }
  const typeMonths = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    setMonthsDraft(digits)
    const n = Number(digits)
    if (n >= MIN_MONTHS && n <= MAX_MONTHS) {
      setTargetMonths(n)
      save(n, essentials)
    }
  }

  if (!open) return null

  return (
    <>
      <ModalShell open={open} onBackdropClick={onClose} scrollChild>
        <div className="flex min-h-0 flex-1 flex-col">
          <V3SheetHeader onClose={onClose}>
            <V3SheetHeader.Title>{t.title}</V3SheetHeader.Title>
            <V3SheetHeader.Subtitle>{c.subtitle}</V3SheetHeader.Subtitle>
          </V3SheetHeader>

          <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-3 pt-1">
            <div className="flex flex-col items-center pb-4 pt-2 text-center">
              <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
                <ShieldCheck className="size-6" />
              </span>
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="font-mono-numbers text-[2.5rem] font-semibold leading-none tracking-[-0.04em] text-[var(--color-brand-text-primary)]">
                  {fund.monthsCovered.toFixed(1)}
                </span>
                <span className="text-[1.0625rem] font-semibold text-[var(--color-brand-text-secondary)]">{c.ofMonths(targetMonths)}</span>
              </p>
              <p className="mt-2 font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
                {c.coveredLine(fmtNum(cover), fmtNum(fund.gap))}
              </p>
            </div>
            <Progress value={pct} aria-label={t.monthsOf(fund.monthsCovered.toFixed(1), targetMonths)}>
              <ProgressTrack className="h-1.5 bg-[var(--color-brand-sunken)]">
                <ProgressIndicator className="bg-[var(--color-brand-primary)]" />
              </ProgressTrack>
            </Progress>

            <p style={micro} className="mb-2 ms-1 mt-6">{c.yourFund}</p>
            <Card padding="none" divide className="overflow-hidden">
              <div className="flex min-h-14 items-center gap-3 px-4">
                <label htmlFor="ef-months" className="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{c.monthsInput}</label>
                <span className="flex items-center gap-1">
                  <IconButton aria-label={t.fewer} variant="sheetAction" disabled={targetMonths <= MIN_MONTHS} onClick={() => setMonths(targetMonths - 1)}>
                    <Minus className="size-4" />
                  </IconButton>
                  <input
                    id="ef-months"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    value={monthsDraft}
                    onChange={(e) => typeMonths(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={() => setMonthsDraft(String(targetMonths))}
                    className="h-11 w-10 bg-transparent text-center font-mono-numbers text-[1.25rem] font-bold text-[var(--color-brand-text-primary)] outline-none"
                  />
                  <IconButton aria-label={t.more} variant="sheetAction" disabled={targetMonths >= MAX_MONTHS} onClick={() => setMonths(targetMonths + 1)}>
                    <Plus className="size-4" />
                  </IconButton>
                </span>
              </div>
              <PickerRow
                label={t.simpleMonth}
                onClick={() => setMonthOpen(true)}
                aria-label={`${t.simpleMonth}: ${fmtNum(essentials)}`}
                value={<span className="font-mono-numbers font-semibold">{fmtNum(essentials)}</span>}
              />
              <PickerRow
                label={t.target}
                value={<span className="font-mono-numbers font-semibold">{fmtNum(target)}</span>}
              />
            </Card>
            <p className="ms-1 mt-2 text-xs text-[var(--color-brand-text-secondary)]">{c.footnote}</p>
          </div>

          <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
            <Button
              size="cta-block"
              onClick={() => {
                if (!cfg) save(targetMonths, essentials)
                onClose()
                onAddMoney?.()
              }}
            >
              {t.addMoney}
            </Button>
          </div>
        </div>
      </ModalShell>
      {monthOpen ? (
        <SimpleMonthSheet
          open
          onClose={() => setMonthOpen(false)}
          month={derived}
          currency={currency}
          initialOwn={cfg?.monthlyEssentials && Math.round(cfg.monthlyEssentials) !== Math.round(derived.total) ? String(cfg.monthlyEssentials) : ''}
          debtsLine={debtsLine || undefined}
          onUse={(figure) => save(targetMonths, figure)}
        />
      ) : null}
    </>
  )
}
