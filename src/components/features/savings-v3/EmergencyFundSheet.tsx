'use client'

import { selectActivePlan } from '@/lib/budget/activePlan'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Info, Minus, Plus, Shield, Sparkles } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CategoryIcon } from '@/components/dashboard/CategoryIcon'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deriveSimpleMonth, type SimpleMonth } from '@/lib/savings/simpleMonth'
import { estimateEmergencyFund } from '@/lib/savings/estimateEmergencyFund'
import { computeEmergencyFund } from '@/lib/savings/emergencyFund'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import { useT } from '@/lib/i18n'
import type { EmergencyFundConfig } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AmountField } from '@/components/ui/AmountField'
import { OptionChip } from '@/components/ui/OptionChip'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'

export interface EmergencyFundSheetProps {
  open: boolean
  onClose: () => void
  /** Which view opens first. Defaults to Details once a fund is set up, Set up before. */
  mode?: 'details' | 'edit'
  /** Details → "Add money". The page opens its add sheet; the fund sheet closes. */
  onAddMoney?: () => void
}

type LineKey = Exclude<keyof SimpleMonth, 'total'>
const LINES: Array<{ key: LineKey; cat: string; tone: string }> = [
  { key: 'rent', cat: 'rent', tone: 'rent' },
  { key: 'food', cat: 'food', tone: 'food' },
  { key: 'transport', cat: 'transport', tone: 'transport' },
  { key: 'bills', cat: 'bills', tone: 'utilities' },
  { key: 'debtMinimums', cat: 'debt', tone: 'debt' },
]

const parseFigure = (raw: string) => parseFloat(raw.replace(/,/g, '')) || 0

export function EmergencyFundSheet({ open, onClose, mode, onAddMoney }: EmergencyFundSheetProps) {
  const t = useT().wealthSheets.ef
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
  const [existed] = useState(!!cfg)
  const [view, setView] = useState<'details' | 'edit'>(mode ?? (cfg ? 'details' : 'edit'))
  const [targetMonths, setTargetMonths] = useState(cfg?.targetMonths ?? 3)
  const [ownFigure, setOwnFigure] = useState(cfg?.monthlyEssentials ? String(cfg.monthlyEssentials) : '')
  const [off, setOff] = useState<ReadonlySet<LineKey>>(new Set())
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const activePlan = selectActivePlan(budgetPlans, activeBudgetPlanId) ?? undefined
  const derived = useMemo(
    () => deriveSimpleMonth({ profile, activePlan, debts, baseCurrency: currency, exchangeRates }),
    [profile, activePlan, debts, currency, exchangeRates],
  )
  const chipSum = LINES.reduce((sum, l) => (off.has(l.key) ? sum : sum + derived[l.key]), 0)
  const own = parseFigure(ownFigure)
  const essentials = own > 0 ? own : chipSum
  const needed = essentials * targetMonths

  const goldOk = goldPriceAvailable !== false
  const cover = useMemo(() => {
    const pockets = savingsAccounts.filter((a) => a.category === 'savings')
    const ids = cfg?.coverPocketIds ?? pockets.map((a) => a.id)
    return pockets
      .filter((a) => ids.includes(a.id))
      .reduce((s, a) => s + (savingsAccountBalanceInBase(a, currency, exchangeRates, goldPricePerGram, goldOk) ?? 0), 0)
  }, [savingsAccounts, cfg?.coverPocketIds, currency, exchangeRates, goldPricePerGram, goldOk])
  const fund = computeEmergencyFund({ coverAmount: cover, monthlyEssentials: essentials, targetMonths })

  const save = (months: number, figure: number, lines: ReadonlySet<LineKey>) => {
    const sum = LINES.reduce((acc, l) => (lines.has(l.key) ? acc : acc + derived[l.key]), 0)
    const monthlyEssentials = figure > 0 ? figure : lines.size > 0 ? sum : undefined
    // Cover is your whole liquid savings — no per-pocket list is written.
    const next: EmergencyFundConfig = { targetMonths: months, monthlyEssentials }
    updateProfile({ emergencyFundConfig: next })
  }
  const setMonths = (m: number) => { const v = Math.max(1, Math.min(24, m)); setTargetMonths(v); save(v, own, off) }
  const toggleLine = (key: LineKey) => {
    const next = new Set(off)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setOff(next); save(targetMonths, own, next)
  }
  const changeFigure = (raw: string) => { setOwnFigure(raw); save(targetMonths, parseFigure(raw), off) }

  const runAiEstimate = async () => {
    setAiBusy(true); setAiError(null); setAiNote(null)
    try {
      const est = await estimateEmergencyFund({ currency, trackedEssentials: chipSum })
      setTargetMonths(est.targetMonths)
      setOwnFigure(String(est.monthlyEssentials))
      save(est.targetMonths, est.monthlyEssentials, off)
      setAiNote(est.rationale || t.estimated(fmtNum(est.monthlyEssentials), currency))
    } catch (e) {
      setAiError(e instanceof Error ? e.message : t.estimateFailed)
    } finally {
      setAiBusy(false)
    }
  }

  if (!open) return null

  if (view === 'details') {
    const pct = targetMonths > 0 ? Math.min(100, (fund.monthsCovered / targetMonths) * 100) : 0
    const state = fund.atOrAboveTarget ? 'secured' : cover > 0 ? 'building' : 'empty'
    const tone = state === 'secured' ? 'green' : 'amber'
    const status = state === 'secured' ? t.secured : state === 'building' ? t.building : t.notSaved
    const rows: Array<[string, string]> = [
      [t.essentials, `${fmtNum(essentials)} ${currency}`],
      [t.target, `${fmtNum(needed)} ${currency}`],
      [t.covered, `${fmtNum(cover)} ${currency}`],
      [t.stillToSave, `${fmtNum(fund.gap)} ${currency}`],
    ]
    return (
      <ModalShell open={open} onBackdropClick={onClose} scrollChild>
        <div className="flex min-h-0 flex-1 flex-col">
          <V3SheetHeader onClose={onClose}>
            <V3SheetHeader.Title>{t.title}</V3SheetHeader.Title>
          </V3SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-3 pt-1">
            <Card variant="elevated" padding="md">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `var(--color-brand-${tone}-soft)`, color: `var(--color-brand-${tone})` }}>
                  <Shield size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{status}</p>
                  <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">
                    {state === 'secured' && fund.monthsCovered > targetMonths
                      ? t.aboveTarget((fund.monthsCovered - targetMonths).toFixed(1))
                      : t.monthsOf(fund.monthsCovered.toFixed(1), targetMonths)}
                  </p>
                </div>
              </div>
              <Progress value={pct} aria-label={status} className="mt-3">
                <ProgressTrack className="h-1.5 bg-[var(--color-brand-sunken)]">
                  <ProgressIndicator className={`bg-[var(--color-brand-${tone})]`} />
                </ProgressTrack>
              </Progress>
            </Card>
            <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden">
              {rows.map(([label, value]) => (
                <div key={label} className="flex min-h-11 items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="text-sm text-[var(--color-brand-text-secondary)]">{label}</span>
                  <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{value}</span>
                </div>
              ))}
            </Card>
          </div>
          <div className="flex gap-3 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
            <Button variant="outline" size="cta" className="flex-1" onClick={() => setView('edit')}>{t.edit}</Button>
            <Button size="cta" className="flex-1" onClick={() => { onClose(); onAddMoney?.() }}>{t.addMoney}</Button>
          </div>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{existed ? t.editTitle : t.setupTitle}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.subtitle}</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-3">
          <Card variant="elevated" padding="md" className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.monthsToCover}</p>
              <p className="text-xs text-[var(--color-brand-text-muted)]">{t.monthsHint}</p>
            </div>
            <div className="flex items-center gap-2">
              <IconButton aria-label={t.fewer} variant="outlined" onClick={() => setMonths(targetMonths - 1)}><Minus /></IconButton>
              <span className="font-mono-numbers min-w-6 text-center text-xl font-bold text-[var(--color-brand-text-primary)]">{targetMonths}</span>
              <IconButton aria-label={t.more} variant="outlined" onClick={() => setMonths(targetMonths + 1)}><Plus /></IconButton>
            </div>
          </Card>

          <div>
            <p style={micro}>{t.simpleMonthEyebrow}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LINES.filter((l) => derived[l.key] > 0).map((l) => (
                <OptionChip key={l.key} selected={!off.has(l.key)} onClick={() => toggleLine(l.key)} className="ps-1.5">
                  <span
                    className="flex size-7 items-center justify-center rounded-full"
                    style={{ background: `var(--cat-${l.tone}-bg)`, color: `var(--cat-${l.tone}-fg)` }}
                  >
                    <CategoryIcon category={l.cat} className="size-3.5" />
                  </span>
                  {t[l.key]}
                  <span className="font-mono-numbers text-xs font-medium text-[var(--color-brand-text-muted)]">{fmtNum(derived[l.key])}</span>
                </OptionChip>
              ))}
            </div>
          </div>

          <Card variant="elevated" padding="md" className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.simpleMonth}</p>
              <p className="text-xs text-[var(--color-brand-text-muted)]">{t.simpleMonthSub}</p>
            </div>
            <span className="font-mono-numbers text-lg font-bold text-[var(--color-brand-text-primary)]">{fmtNum(chipSum)}</span>
          </Card>

          <div>
            <p style={micro}>{t.ownFigure}</p>
            <div className="mt-2">
              <AmountField value={ownFigure} onChange={changeFigure} currency={currency} placeholder="0" />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-brand-text-muted)]">{t.figureWins}</p>
          </div>

          <Button variant="outline" size="cta-block" onClick={runAiEstimate} disabled={aiBusy}>
            <Sparkles size={15} className={aiBusy ? 'animate-pulse' : ''} />
            {aiBusy ? t.estimating : t.estimate}
          </Button>
          {aiError ? <p role="alert" className="text-xs text-[var(--color-brand-red)]">{aiError}</p> : null}
          {aiNote ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{aiNote}</p> : null}

          <Card padding="md" className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.needed(targetMonths)}</p>
              <p className="font-mono-numbers text-xs text-[var(--color-brand-text-muted)]">{t.neededSub(fmtNum(essentials), targetMonths)}</p>
            </div>
            <span className="font-mono-numbers text-lg font-bold text-[var(--color-brand-text-primary)]">{fmtNum(needed)}</span>
          </Card>

          <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5">
            <Info size={16} className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" />
            <p className="text-sm text-[var(--color-brand-text-secondary)]">
              <span className="font-semibold text-[var(--color-brand-text-primary)]">{t.coverBold}</span> {t.coverRest}
            </p>
          </div>
        </div>

        <div className="px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Button
            size="cta-block"
            onClick={() => { save(targetMonths, own, off); if (mode === 'edit' || !existed) onClose(); else setView('details') }}
          >
            {existed ? t.done : t.setUp}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
