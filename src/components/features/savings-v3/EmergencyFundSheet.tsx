'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Minus, Plus, Shield, Sparkles } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deriveSimpleMonth } from '@/lib/savings/simpleMonth'
import { estimateEmergencyFund } from '@/lib/savings/estimateEmergencyFund'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { micro } from '@/lib/ui/microLabelStyle'
import type { EmergencyFundConfig } from '@/lib/store/types'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'

export interface EmergencyFundSheetProps {
  open: boolean
  onClose: () => void
}

export function EmergencyFundSheet({ open, onClose }: EmergencyFundSheetProps) {
  const { budgetPlans, activeBudgetPlanId, debts, profile, settings, exchangeRates, updateProfile } = useFinanceStore(
    useShallow((s) => ({
      budgetPlans: s.budgetPlans, activeBudgetPlanId: s.activeBudgetPlanId,
      debts: s.debts, profile: s.profile, settings: s.settings, exchangeRates: s.exchangeRates,
      updateProfile: s.updateProfile,
    })),
  )

  const cfg = profile.emergencyFundConfig ?? undefined
  const [targetMonths, setTargetMonths] = useState(cfg?.targetMonths ?? 3)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNote, setAiNote] = useState<string | null>(null)

  const simple = useMemo(
    () => deriveSimpleMonth({ profile, activePlan: budgetPlans.find((p) => p.id === activeBudgetPlanId) ?? budgetPlans[0], debts, baseCurrency: settings.baseCurrency, exchangeRates, override: cfg?.monthlyEssentials }),
    [profile, budgetPlans, activeBudgetPlanId, debts, settings.baseCurrency, exchangeRates, cfg?.monthlyEssentials],
  )
  const needed = simple.total * targetMonths

  const save = (patch: Partial<EmergencyFundConfig>) => {
    // Cover is your whole liquid savings now — no per-pocket list is written.
    updateProfile({ emergencyFundConfig: { targetMonths, monthlyEssentials: cfg?.monthlyEssentials, ...patch } })
  }
  const setMonths = (m: number) => { const v = Math.max(1, Math.min(24, m)); setTargetMonths(v); save({ targetMonths: v }) }

  const runAiEstimate = async () => {
    setAiBusy(true); setAiError(null); setAiNote(null)
    try {
      const est = await estimateEmergencyFund({ currency: settings.baseCurrency, trackedEssentials: simple.total })
      setTargetMonths(est.targetMonths)
      save({ monthlyEssentials: est.monthlyEssentials, targetMonths: est.targetMonths })
      setAiNote(est.rationale || `Estimated ${fmtNum(est.monthlyEssentials)} ${settings.baseCurrency}/month.`)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Could not estimate right now.')
    } finally {
      setAiBusy(false)
    }
  }

  if (!open) return null

  const lines: Array<[string, number]> = [
    ['Rent', simple.rent], ['Food', simple.food], ['Transport', simple.transport], ['Bills', simple.bills], ['Debt minimums', simple.debtMinimums],
  ]

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>Emergency fund</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>Months you could cover on a simple version of your life — not your usual budget.</V3SheetHeader.Subtitle>
        </V3SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3 space-y-4">
          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">Months to cover</span>
              <div className="flex items-center gap-3">
                <IconButton aria-label="Fewer months" variant="outlined" size="sm" onClick={() => setMonths(targetMonths - 1)}><Minus className="size-4" /></IconButton>
                <span className="font-mono-numbers text-xl font-bold text-[var(--color-brand-text-primary)]" style={{ minWidth: 20, textAlign: 'center' }}>{targetMonths}</span>
                <IconButton aria-label="More months" variant="outlined" size="sm" onClick={() => setMonths(targetMonths + 1)}><Plus className="size-4" /></IconButton>
              </div>
            </div>
            <div className="my-3 h-px bg-[var(--color-brand-border)]" />
            <p style={micro}>A simple month</p>
            <div className="mt-2 space-y-1.5">
              {lines.map(([name, val]) => (
                <div key={name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-[var(--color-brand-text-secondary)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: '#7EAEF9' }} />{name}</span>
                  <span className="font-mono-numbers text-sm text-[var(--color-brand-text-muted)]">{fmtNum(val)} EGP</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">A simple month</span>
              <span className="font-mono-numbers text-[15px] font-bold text-[var(--color-brand-text-primary)]">{fmtNum(simple.total)} EGP</span>
            </div>
            <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">Rent, food, transport, bills and debt minimums — the fancy parts of your budget are left out on purpose.</p>

            {/* AI estimate — grounded on local cost of living; user can still edit the months above. */}
            <Button variant="outline" size="cta-block" onClick={runAiEstimate} disabled={aiBusy}
              className="mt-3 border-[var(--color-cat-6)]/40 bg-[var(--color-cat-6)]/10 font-semibold text-[var(--color-cat-6)] hover:bg-[var(--color-cat-6)]/20">
              <Sparkles size={15} className={aiBusy ? 'animate-pulse' : ''} />
              {aiBusy ? 'Estimating for your country…' : 'Estimate with AI'}
            </Button>
            {aiError ? <p className="mt-2 text-xs" style={{ color: '#FF6B6B' }}>{aiError}</p> : null}
            {aiNote ? <p className="mt-2 text-xs text-[var(--color-brand-text-secondary)]">{aiNote}</p> : null}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-[rgba(126,174,249,.4)] bg-[rgba(126,174,249,.06)] p-3.5">
            <span className="text-sm font-semibold" style={{ color: '#7EAEF9' }}>Needed for {targetMonths} months</span>
            <span className="font-mono-numbers text-lg font-bold text-[var(--color-brand-text-primary)]">{fmtNum(needed)} EGP</span>
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5">
            <Shield size={16} className="mt-0.5 shrink-0" style={{ color: '#7EAEF9' }} />
            <p className="text-xs text-[var(--color-brand-text-secondary)]">This money is kept out of every goal, so a goal can never quietly eat your safety net.</p>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
