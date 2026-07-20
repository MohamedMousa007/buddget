'use client'

import { CreditCard as CardIcon } from 'lucide-react'
import { heroCardStyle } from '@/components/features/income/incomeGlass'
import type { InstallmentVM } from '@/hooks/useDebtTabData'
import { EditPin, fmtWhole } from './heroCardShared'
import { ProviderBadge } from './ProviderBadge'

export interface InstallmentHeroCardProps {
  vm: InstallmentVM
  onEdit: () => void
  onPay: () => void
}

/** Installment / BNPL plan hero — segmented progress, provider mark (handoff §3). */
export function InstallmentHeroCard({ vm, onEdit, onPay }: InstallmentHeroCardProps) {
  const accent = vm.brandColor
  const segments = Array.from({ length: Math.max(vm.count, 1) }, (_, i) => (i < vm.paid ? 'paid' : i === vm.paid ? 'next' : 'todo'))

  return (
    <div className="relative flex flex-col rounded-[18px] p-4 text-white" style={heroCardStyle(accent)}>
      <EditPin onClick={onEdit} label="Edit plan" />

      {/* Header: provider mark + card tag */}
      <div className="flex items-center gap-2 pe-9">
        <span
          className="flex h-9 items-center gap-1.5 rounded-[10px] px-1.5 pe-2.5 text-[13px] font-extrabold"
          style={{ background: `${accent}26`, color: accent }}
        >
          <ProviderBadge slug={vm.logoSlug} name={vm.providerName} color={accent} size={26} />
          {vm.providerName}
        </span>
        {vm.onCardLast4 ? (
          <span className="flex h-9 items-center gap-1.5 rounded-[10px] border border-white/12 px-2.5 text-[11px] font-semibold text-white/70">
            <CardIcon className="h-3.5 w-3.5" />
            <span className="font-mono-numbers">CARD ••••{vm.onCardLast4}</span>
          </span>
        ) : null}
      </div>

      {/* Item */}
      <p className="mt-3 truncate text-xl font-bold leading-tight">{vm.item}</p>

      {/* Segmented progress bar */}
      <div className="mt-3 flex gap-1.5">
        {segments.map((s, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-full"
            style={{
              background: s === 'paid' ? accent : 'transparent',
              border: s === 'next' ? `1.5px solid ${accent}` : s === 'todo' ? '1.5px solid rgba(255,255,255,.12)' : 'none',
              boxShadow: s === 'todo' ? 'inset 0 0 0 100px rgba(255,255,255,.05)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Outstanding + next cycle */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-white/45">
            Outstanding · {vm.paid} of {vm.count} paid
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-mono-numbers text-[32px] font-bold leading-none tracking-[-1px]">{fmtWhole(vm.remaining)}</span>
            <span className="text-sm text-white/55">{vm.currency}</span>
          </p>
          <p className="mt-1 font-mono-numbers text-[12px] text-white/55">
            {Math.max(0, vm.count - vm.paid)} × {fmtWhole(vm.per)} left
          </p>
        </div>
        {vm.next ? (
          <div className="shrink-0 pb-1 text-end">
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-white/45">Next cycle</p>
            <p className="mt-1 font-mono-numbers text-sm font-bold">{vm.next}</p>
          </div>
        ) : null}
      </div>

      {/* CTA inside */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onPay}
          className="h-11 w-full rounded-[13px] text-sm font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: accent }}
        >
          Pay next · {fmtWhole(vm.per)} {vm.currency}
        </button>
      </div>
    </div>
  )
}
