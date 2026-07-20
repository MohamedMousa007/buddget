'use client'

import { ArrowUpRight, ArrowDownRight, Target } from 'lucide-react'
import { heroCardStyle } from '@/components/features/income/incomeGlass'
import type { BorrowVM } from '@/hooks/useDebtTabData'
import { EditPin, fmtWhole } from './heroCardShared'

export interface BorrowHeroCardProps {
  vm: BorrowVM
  onEdit: () => void
  onPay: () => void
}

/** Borrow (person-to-person / gold) hero card — handoff §3. */
export function BorrowHeroCard({ vm, onEdit, onPay }: BorrowHeroCardProps) {
  const owe = vm.dir === 'owe'
  const pct = vm.total > 0 ? Math.max(0, Math.min(100, (vm.paid / vm.total) * 100)) : 0
  const accent = vm.accent

  return (
    <div className="relative flex flex-col rounded-[18px] p-4 text-white" style={heroCardStyle(accent)}>
      <EditPin onClick={onEdit} label="Edit debt" />

      {/* Header */}
      <div className="flex items-start gap-3 pe-9">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-lg font-bold"
          style={{ background: `${accent}22`, color: accent }}
        >
          {vm.avatarInit}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">{vm.name}</p>
          {vm.relation ? <p className="truncate text-sm text-white/60">{vm.relation}</p> : null}
        </div>
        <span
          className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
          style={{
            background: owe ? 'rgba(229,9,20,.16)' : 'rgba(29,185,84,.16)',
            color: owe ? '#F76D74' : '#35D46F',
          }}
        >
          {owe ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {owe ? 'I owe' : 'Owed to me'}
        </span>
      </div>

      {/* Remaining */}
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono-numbers text-[38px] font-bold leading-none tracking-[-1px]">{fmtWhole(vm.remaining)}</span>
        <span className="text-sm text-white/55">
          {vm.currency} {owe ? 'left' : 'owed to you'}
        </span>
      </div>

      {/* Progress */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: accent }} />
      </div>
      <p className="mt-2 font-mono-numbers text-[13px] text-white/60">
        Paid {fmtWhole(vm.paid)} of {fmtWhole(vm.total)}
      </p>

      {vm.gold ? (
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-[rgba(245,200,66,.14)] px-2.5 py-1 text-xs font-semibold text-[#F5C842]">
          {vm.gold.grams.toFixed(1)}g · {vm.gold.karat}K
        </span>
      ) : null}

      {/* Payoff goal strip (borrow-only) */}
      {vm.goal ? (
        <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-[rgba(245,200,66,.35)] bg-[rgba(245,200,66,.08)] px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(245,200,66,.18)] text-[#F5C842]">
            <Target className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#F5C842]">Goal · clear by {vm.goal.by}</p>
            <p className="mt-0.5 font-mono-numbers text-[12px] leading-snug text-white/70">
              {vm.goal.remaining} payments left · {fmtWhole(vm.goal.per)}/{vm.goal.cadence === 'monthly' ? 'mo' : vm.goal.cadence}
              {vm.goal.next ? ` · next ${vm.goal.next}` : ''}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{
              background: vm.goal.onTrack ? 'rgba(29,185,84,.2)' : 'rgba(255,177,61,.2)',
              color: vm.goal.onTrack ? '#35D46F' : '#FFB13D',
            }}
          >
            {vm.goal.onTrack ? 'On track' : 'Behind'}
          </span>
        </div>
      ) : null}

      {/* CTA inside */}
      <div className="mt-4 border-t border-white/10 pt-3">
        {owe ? (
          <button
            type="button"
            onClick={onPay}
            className="h-11 w-full rounded-[13px] bg-[var(--color-brand-red)] text-sm font-bold text-white transition-colors hover:bg-[var(--color-brand-red-hover)]"
          >
            Pay {vm.name}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPay}
            className="h-11 w-full rounded-[13px] border border-[#35D46F]/50 text-sm font-bold text-[#35D46F] transition-colors hover:bg-[#35D46F]/10"
          >
            Log receipt from {vm.name}
          </button>
        )}
      </div>
    </div>
  )
}
