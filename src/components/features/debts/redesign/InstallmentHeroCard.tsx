'use client'

import { CreditCard as CardIcon } from 'lucide-react'
import type { InstallmentVM } from '@/hooks/useDebtTabData'
import { DebtCardFrame, EditPin, fmtWhole, readable, soft } from './heroCardShared'
import { ProviderBadge } from './ProviderBadge'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

export interface InstallmentHeroCardProps {
  vm: InstallmentVM
  onEdit: () => void
  onDelete?: () => void
  onPay: () => void
}

/** Installment / BNPL plan hero — segmented progress, provider mark (handoff §3). */
export function InstallmentHeroCard({ vm, onEdit, onDelete, onPay }: InstallmentHeroCardProps) {
  const t = useT().debts
  const accent = readable(vm.brandColor)
  const segments = Array.from({ length: Math.max(vm.count, 1) }, (_, i) => (i < vm.paid ? 'paid' : i === vm.paid ? 'next' : 'todo'))

  return (
    <DebtCardFrame>
      <EditPin onClick={onEdit} onDelete={onDelete} label={t.editPlanAria} deleteLabel={t.deletePlanLabel} deleteBody={t.deletePlanBody} />

      <div className="flex items-center gap-2 pe-9">
        <span
          className="flex h-9 items-center gap-1.5 rounded-[10px] px-1.5 pe-2.5 text-[13px] font-extrabold"
          style={{ background: soft(vm.brandColor, 16), color: accent }}
        >
          <ProviderBadge slug={vm.logoSlug} name={vm.providerName} color={vm.brandColor} size={26} />
          {vm.providerName}
        </span>
        {vm.onCardLast4 ? (
          <span className="flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--color-brand-border)] px-2.5 text-[11px] font-semibold text-[var(--color-brand-text-secondary)]">
            <CardIcon className="h-3.5 w-3.5" />
            <span className="font-mono-numbers">{t.cardTag(vm.onCardLast4)}</span>
          </span>
        ) : null}
      </div>

      <p className="mt-3 truncate text-xl font-bold leading-tight text-[var(--color-brand-text-primary)]">{vm.item}</p>

      <div className="mt-3 flex gap-1.5">
        {segments.map((s, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${s === 'todo' ? 'bg-[var(--color-brand-elevated)]' : ''}`}
            style={{
              background: s === 'paid' ? accent : undefined,
              border: s === 'next' ? `1.5px solid ${accent}` : s === 'todo' ? '1.5px solid var(--color-brand-border)' : 'none',
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-text-muted)]">
            {t.outstandingPaidOf(vm.paid, vm.count)}
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-mono-numbers text-[32px] font-bold leading-none tracking-[-1px] text-[var(--color-brand-text-primary)]">{fmtWhole(vm.remaining)}</span>
            <span className="text-sm text-[var(--color-brand-text-muted)]">{vm.currency}</span>
          </p>
          <p className="mt-1 font-mono-numbers text-[12px] text-[var(--color-brand-text-muted)]">
            {t.installmentsLeft(Math.max(0, vm.count - vm.paid), fmtWhole(vm.per))}
          </p>
        </div>
        {vm.next ? (
          <div className="shrink-0 pb-1 text-end">
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-text-muted)]">{t.nextCycle}</p>
            <p className="mt-1 font-mono-numbers text-sm font-bold text-[var(--color-brand-text-primary)]">{vm.next}</p>
            {vm.method ? <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--color-brand-text-muted)]">{vm.method}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 border-t border-[var(--color-brand-border)] pt-3">
        <Button size="cta-block" onClick={onPay} className="font-bold">
          {t.payNextAmt(fmtWhole(vm.per), vm.currency)}
        </Button>
      </div>
    </DebtCardFrame>
  )
}
