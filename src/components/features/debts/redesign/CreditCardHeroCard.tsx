'use client'

import { parseISO } from 'date-fns'
import { Receipt } from 'lucide-react'
import type { CreditCardVM } from '@/hooks/useDebtTabData'
import { DebtBar, DebtCardFrame, EditPin, fmtWhole, soft } from './heroCardShared'
import { Button } from '@/components/ui/button'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'

export interface CreditCardHeroCardProps {
  vm: CreditCardVM
  onEdit: () => void
  onDelete?: () => void
  onPay: () => void
  onCharges: () => void
}

function barTone(utilPct: number | null): string {
  if (utilPct == null) return 'var(--color-cat-6)'
  if (utilPct < 30) return 'var(--color-brand-green)'
  if (utilPct <= 100) return 'var(--color-brand-amber)'
  return 'var(--color-brand-red)'
}

const STAT_LABEL = 'truncate text-[9.5px] font-bold uppercase tracking-[0.04em] text-[var(--color-brand-text-muted)]'
const STAT_BOX = 'rounded-[11px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2.5 py-2'
const STAT_VALUE = 'mt-0.5 font-mono-numbers text-[14px] font-bold leading-tight text-[var(--color-brand-text-primary)]'

/** Revolving credit-card hero — compact card-like, 3 stat boxes (handoff §3). */
export function CreditCardHeroCard({ vm, onEdit, onDelete, onPay, onCharges }: CreditCardHeroCardProps) {
  const t = useT().debts
  const { locale } = useLocale()
  const over = vm.overBy > 0
  const tone = barTone(vm.utilPct)

  return (
    <DebtCardFrame>
      <EditPin onClick={onEdit} onDelete={onDelete} label={t.editCardAria} deleteLabel={t.deleteCardLabel} deleteBody={t.deleteCardBody} />

      <div className="flex items-center gap-3 pe-9">
        <span
          className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-extrabold tracking-tight"
          style={{ background: soft(vm.color, 16), color: vm.color }}
        >
          {vm.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight text-[var(--color-brand-text-primary)]">{vm.bank}</p>
          <p className="truncate font-mono-numbers text-[13px] text-[var(--color-brand-text-muted)]">
            {vm.last4 ? `••${vm.last4}` : '••••'} · {t.cardSuffixDebt}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{t.outstandingShort}</p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono-numbers text-[26px] font-bold leading-none tracking-[-0.5px] text-[var(--color-brand-text-primary)]">{fmtWhole(vm.outstanding)}</span>
            <span className="text-[13px] text-[var(--color-brand-text-muted)]">{vm.currency}</span>
          </p>
        </div>
        {vm.utilPct != null ? (
          <div className="shrink-0 text-end">
            <p className="font-mono-numbers text-[12px] font-bold" style={{ color: tone }}>
              {t.usedPct(vm.utilPct)}
            </p>
            {over ? (
              <p className="mt-0.5 font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">{t.overByAmt(fmtWhole(vm.overBy))}</p>
            ) : vm.limit != null ? (
              <p className="mt-0.5 font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">{t.freeAmt(fmtWhole(Math.max(0, vm.limit - vm.outstanding)))}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <DebtBar pct={vm.utilPct ?? 0} tone={tone} className="mt-2.5" />

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className={STAT_BOX}>
          <p className={STAT_LABEL}>{vm.due ? t.dueOn(formatLocalized(parseISO(vm.due), 'MMM d', locale)) : t.dueShort}</p>
          <p className={STAT_VALUE}>{vm.daysLeft != null ? t.daysLeftShort(vm.daysLeft) : '—'}</p>
        </div>
        <div className={STAT_BOX}>
          <p className={STAT_LABEL}>{t.allDueLabel}</p>
          <p className={STAT_VALUE}>{fmtWhole(vm.allDue)}</p>
          {vm.installmentDue > 0 ? (
            <p className="text-[9px] font-semibold text-[var(--color-brand-primary-ink)]">{t.inclAmt(fmtWhole(vm.installmentDue))}</p>
          ) : null}
        </div>
        <div className={STAT_BOX}>
          <p className={STAT_LABEL}>{t.afterLabel}</p>
          <p className={STAT_VALUE}>{fmtWhole(vm.after)}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2 border-t border-[var(--color-brand-border)] pt-2.5">
        <Button onClick={onPay} size="touch" className="flex-1">
          {t.payNow}
        </Button>
        <Button onClick={onCharges} variant="outline" size="touch" className="flex-1">
          <Receipt className="h-4 w-4" />
          {t.chargesBtn}
        </Button>
      </div>
    </DebtCardFrame>
  )
}
