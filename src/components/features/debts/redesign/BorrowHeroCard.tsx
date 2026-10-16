'use client'

import { ArrowUpRight, ArrowDownRight, Target } from 'lucide-react'
import type { BorrowVM } from '@/hooks/useDebtTabData'
import { DebtBar, DebtCardFrame, EditPin, fmtWhole, soft } from './heroCardShared'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'

export interface BorrowHeroCardProps {
  vm: BorrowVM
  onEdit: () => void
  onDelete?: () => void
  onPay: () => void
}

/** Borrow (person-to-person / gold) hero card — handoff §3. */
export function BorrowHeroCard({ vm, onEdit, onDelete, onPay }: BorrowHeroCardProps) {
  const t = useT().debts
  const owe = vm.dir === 'owe'
  const pct = vm.total > 0 ? (vm.paid / vm.total) * 100 : 0
  const accent = vm.accent
  const dirTone = owe ? 'var(--color-brand-red)' : 'var(--color-brand-green)'

  return (
    <DebtCardFrame>
      <EditPin onClick={onEdit} onDelete={onDelete} label={t.editDebtAria} deleteLabel={t.deleteDebtLabel} deleteBody={t.deleteDebtBody} />

      <div className="flex items-start gap-3 pe-9">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-lg font-bold"
          style={{ background: soft(accent, 16), color: accent }}
        >
          {vm.avatarInit}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight text-[var(--color-brand-text-primary)]">{vm.name}</p>
          {vm.relation ? <p className="truncate text-sm text-[var(--color-brand-text-muted)]">{vm.relation}</p> : null}
        </div>
      </div>

      <span
        className="mt-3 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
        style={{ background: soft(dirTone, 14), color: dirTone }}
      >
        {owe ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        {owe ? t.iOwe : t.owedToMe}
      </span>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono-numbers text-[38px] font-bold leading-none tracking-[-1px] text-[var(--color-brand-text-primary)]">{fmtWhole(vm.remaining)}</span>
        <span className="text-sm text-[var(--color-brand-text-muted)]">
          {vm.currency} {owe ? t.leftSuffix : t.owedToYouSuffix}
        </span>
      </div>

      <DebtBar pct={pct} tone={accent} className="mt-3" />
      <p className="mt-2 font-mono-numbers text-[13px] text-[var(--color-brand-text-muted)]">
        {t.paidOfTotal(fmtWhole(vm.paid), fmtWhole(vm.total))}
      </p>

      {vm.gold ? (
        <span
          className="mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-gold)]"
          style={{ background: soft('var(--color-brand-gold)', 14) }}
        >
          {vm.gold.grams.toFixed(1)}g · {vm.gold.karat}K
        </span>
      ) : null}

      {vm.goal ? (
        <div
          className="mt-3 flex items-center gap-3 rounded-[14px] border px-3 py-2.5"
          style={{ borderColor: soft('var(--color-brand-gold)', 35), background: soft('var(--color-brand-gold)', 8) }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-brand-gold)]"
            style={{ background: soft('var(--color-brand-gold)', 18) }}
          >
            <Target className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--color-brand-gold)]">{t.goalClearBy(vm.goal.by)}</p>
            <p className="mt-0.5 font-mono-numbers text-[12px] leading-snug text-[var(--color-brand-text-secondary)]">
              {t.goalLine(vm.goal.remaining, fmtWhole(vm.goal.per), vm.goal.cadence, vm.goal.next)}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{
              background: soft(vm.goal.onTrack ? 'var(--color-brand-green)' : 'var(--color-brand-amber)', 18),
              color: vm.goal.onTrack ? 'var(--color-brand-green)' : 'var(--color-brand-amber)',
            }}
          >
            {vm.goal.onTrack ? t.onTrack : t.behind}
          </span>
        </div>
      ) : null}

      <div className="mt-4 border-t border-[var(--color-brand-border)] pt-3">
        {owe ? (
          <Button onClick={onPay} size="cta-block">
            {t.payPerson(vm.name)}
          </Button>
        ) : (
          <Button onClick={onPay} variant="success" size="cta-block">
            {t.logReceiptFrom(vm.name)}
          </Button>
        )}
      </div>
    </DebtCardFrame>
  )
}
