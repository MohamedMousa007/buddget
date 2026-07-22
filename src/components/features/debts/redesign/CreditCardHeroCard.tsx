'use client'

import { format, parseISO } from 'date-fns'
import { Receipt } from 'lucide-react'
import { heroCardStyle } from '@/components/features/income/incomeGlass'
import type { CreditCardVM } from '@/hooks/useDebtTabData'
import { EditPin, fmtWhole } from './heroCardShared'

export interface CreditCardHeroCardProps {
  vm: CreditCardVM
  onEdit: () => void
  onPay: () => void
  onCharges: () => void
}

function barTone(utilPct: number | null): string {
  if (utilPct == null) return '#8A5CF6'
  if (utilPct < 30) return '#1DB954'
  if (utilPct <= 100) return '#FFB13D'
  return '#FF6B6B'
}

/** Revolving credit-card hero — compact card-like, 3 stat boxes (handoff §3). */
export function CreditCardHeroCard({ vm, onEdit, onPay, onCharges }: CreditCardHeroCardProps) {
  const over = vm.overBy > 0
  const barW = vm.utilPct == null ? 0 : Math.min(100, vm.utilPct)
  const tone = barTone(vm.utilPct)

  return (
    <div className="relative flex flex-col rounded-[18px] p-4 text-white" style={heroCardStyle(vm.color)}>
      <EditPin onClick={onEdit} label="Edit card" />

      {/* Header: bank mark + name + last4 · Debt */}
      <div className="flex items-center gap-3 pe-9">
        <span
          className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-extrabold tracking-tight"
          style={{ background: `linear-gradient(135deg, ${vm.color}, ${vm.color}bb)`, color: '#fff' }}
        >
          {vm.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">{vm.bank}</p>
          <p className="truncate font-mono-numbers text-[13px] text-white/55">
            {vm.last4 ? `••${vm.last4}` : '••••'} · Debt
          </p>
        </div>
      </div>

      {/* Outstanding + used */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">Outstanding</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono-numbers text-[26px] font-bold leading-none tracking-[-0.5px]">{fmtWhole(vm.outstanding)}</span>
            <span className="text-[13px] text-white/55">{vm.currency}</span>
          </p>
        </div>
        {vm.utilPct != null ? (
          <div className="shrink-0 text-end">
            <p className="font-mono-numbers text-[12px] font-bold" style={{ color: over ? '#FF6B6B' : tone }}>
              {vm.utilPct}% used
            </p>
            {over ? (
              <p className="mt-0.5 font-mono-numbers text-[11px] text-white/55">over by {fmtWhole(vm.overBy)}</p>
            ) : vm.limit != null ? (
              <p className="mt-0.5 font-mono-numbers text-[11px] text-white/45">{fmtWhole(Math.max(0, vm.limit - vm.outstanding))} free</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Utilization bar (capped 100) */}
      <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${barW}%`, background: tone }} />
      </div>

      {/* 3 stat boxes */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[11px] border border-white/10 bg-white/[.03] px-2.5 py-2">
          <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.04em] text-white/45">
            {vm.due ? `Due ${format(parseISO(vm.due), 'MMM d')}` : 'Due'}
          </p>
          <p className="mt-0.5 font-mono-numbers text-[14px] font-bold leading-tight">
            {vm.daysLeft != null ? `${vm.daysLeft}d left` : '—'}
          </p>
        </div>
        <div className="rounded-[11px] border border-white/10 bg-white/[.03] px-2.5 py-2">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.04em] text-white/45">All due</p>
          <p className="mt-0.5 font-mono-numbers text-[14px] font-bold leading-tight">{fmtWhole(vm.allDue)}</p>
          {vm.installmentDue > 0 ? (
            <p className="text-[9px] font-semibold text-[#2CE0C6]">incl. {fmtWhole(vm.installmentDue)}</p>
          ) : null}
        </div>
        <div className="rounded-[11px] border border-white/10 bg-white/[.03] px-2.5 py-2">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.04em] text-white/45">After</p>
          <p className="mt-0.5 font-mono-numbers text-[14px] font-bold leading-tight">{fmtWhole(vm.after)}</p>
        </div>
      </div>

      {/* CTAs inside */}
      <div className="mt-3 flex gap-2 border-t border-white/10 pt-2.5">
        <button
          type="button"
          onClick={onPay}
          className="h-11 flex-1 rounded-[13px] bg-[var(--color-brand-red)] text-sm font-bold text-white transition-colors hover:bg-[var(--color-brand-red-hover)]"
        >
          Pay now
        </button>
        <button
          type="button"
          onClick={onCharges}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[13px] border border-white/15 text-sm font-semibold text-white/85 transition-colors hover:bg-white/5"
        >
          <Receipt className="h-4 w-4" />
          Charges
        </button>
      </div>
    </div>
  )
}
