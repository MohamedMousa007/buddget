'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Check, Minus, Plus, Shield, X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { deriveSimpleMonth } from '@/lib/savings/simpleMonth'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import type { EmergencyFundConfig } from '@/lib/store/types'

const micro: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-brand-text-muted)' }
const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')

export interface EmergencyFundSheetProps {
  open: boolean
  onClose: () => void
}

export function EmergencyFundSheet({ open, onClose }: EmergencyFundSheetProps) {
  const { savingsAccounts, budgetPlans, activeBudgetPlanId, debts, profile, settings, exchangeRates, goldPricePerGram, goldPriceAvailable, updateProfile } = useFinanceStore(
    useShallow((s) => ({
      savingsAccounts: s.savingsAccounts, budgetPlans: s.budgetPlans, activeBudgetPlanId: s.activeBudgetPlanId,
      debts: s.debts, profile: s.profile, settings: s.settings, exchangeRates: s.exchangeRates,
      goldPricePerGram: s.goldPricePerGram, goldPriceAvailable: s.goldPriceAvailable, updateProfile: s.updateProfile,
    })),
  )

  const cfg = profile.emergencyFundConfig ?? undefined
  const [targetMonths, setTargetMonths] = useState(cfg?.targetMonths ?? 3)
  const [coverIds, setCoverIds] = useState<string[]>(
    cfg?.coverPocketIds ?? savingsAccounts.filter((a) => a.category === 'savings' && a.isEmergencyCover).map((a) => a.id),
  )

  const pockets = savingsAccounts.filter((a) => a.category === 'savings')
  const simple = useMemo(
    () => deriveSimpleMonth({ profile, activePlan: budgetPlans.find((p) => p.id === activeBudgetPlanId) ?? budgetPlans[0], debts, baseCurrency: settings.baseCurrency, exchangeRates, override: cfg?.monthlyEssentials }),
    [profile, budgetPlans, activeBudgetPlanId, debts, settings.baseCurrency, exchangeRates, cfg?.monthlyEssentials],
  )
  const needed = simple.total * targetMonths

  const save = (patch: Partial<EmergencyFundConfig>) => {
    updateProfile({ emergencyFundConfig: { targetMonths, coverPocketIds: coverIds, monthlyEssentials: cfg?.monthlyEssentials, ...patch } })
  }
  const setMonths = (m: number) => { const v = Math.max(1, Math.min(24, m)); setTargetMonths(v); save({ targetMonths: v }) }
  const toggleCover = (id: string) => {
    const next = coverIds.includes(id) ? coverIds.filter((x) => x !== id) : [...coverIds, id]
    setCoverIds(next); save({ coverPocketIds: next })
  }

  const balanceOf = (id: string) => {
    const a = pockets.find((p) => p.id === id)
    if (!a) return 0
    return savingsAccountBalanceInBase(a, settings.baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable !== false) ?? 0
  }

  if (!open) return null

  const lines: Array<[string, number]> = [
    ['Rent', simple.rent], ['Food', simple.food], ['Transport', simple.transport], ['Bills', simple.bills], ['Debt minimums', simple.debtMinimums],
  ]

  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="flex flex-col" style={{ maxHeight: '92vh' }}>
        <div className="flex items-start justify-between px-5 pt-4 pb-1">
          <div className="pr-4">
            <h2 className="text-[22px] font-bold text-[var(--color-brand-text-primary)]">Emergency fund</h2>
            <p className="mt-0.5 text-sm text-[var(--color-brand-text-secondary)]">Months you could cover on a simple version of your life — not your usual budget.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-3 space-y-4">
          <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">Months to cover</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setMonths(targetMonths - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)]"><Minus size={16} /></button>
                <span className="font-mono-numbers text-xl font-bold text-[var(--color-brand-text-primary)]" style={{ minWidth: 20, textAlign: 'center' }}>{targetMonths}</span>
                <button type="button" onClick={() => setMonths(targetMonths + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)]"><Plus size={16} /></button>
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
          </div>

          <div>
            <p style={micro}>What counts as cover</p>
            <div className="mt-2 space-y-2.5">
              {pockets.map((a) => {
                const on = coverIds.includes(a.id)
                return (
                  <button key={a.id} type="button" onClick={() => toggleCover(a.id)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3 text-left">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: on ? '#7EAEF9' : 'transparent', border: on ? undefined : '1.5px solid var(--color-brand-border)' }}>{on && <Check size={16} color="#fff" strokeWidth={3} />}</span>
                    <span className="flex-1 truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{a.name}</span>
                    <span className="font-mono-numbers text-sm text-[var(--color-brand-text-muted)]">{fmtNum(balanceOf(a.id))}</span>
                  </button>
                )
              })}
            </div>
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
