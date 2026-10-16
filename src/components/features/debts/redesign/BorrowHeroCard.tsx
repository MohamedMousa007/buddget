'use client'

import { Target } from 'lucide-react'
import type { BorrowVM } from '@/hooks/useDebtTabData'
import { DebtBar, DebtCardFrame, EditPin, fmtWhole, soft } from './heroCardShared'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useT } from '@/lib/i18n'

export interface BorrowHeroCardProps {
  vm: BorrowVM
  onEdit: () => void
  onDelete?: () => void
  onPay: () => void
}

/** Borrow (person-to-person / gold) hero card — same scale as the credit-card and installment cards. */
export function BorrowHeroCard({ vm, onEdit, onDelete, onPay }: BorrowHeroCardProps) {
  const t = useT().debts
  const openGoalEdit = useSettingsStore((s) => s.openDebtGoalEdit)
  const owe = vm.dir === 'owe'
  const pct = vm.total > 0 ? (vm.paid / vm.total) * 100 : 0
  const accent = vm.accent
  const dirTone = owe ? 'var(--color-brand-red)' : 'var(--color-brand-green)'
  const subtitle = vm.person && vm.person !== vm.name ? vm.person : vm.relation

  return (
    <DebtCardFrame>
      <EditPin onClick={onEdit} onDelete={onDelete} label={t.editDebtAria} deleteLabel={t.deleteDebtLabel} deleteBody={t.deleteDebtBody} />

      <div className="flex items-center gap-3 pe-9">
        <span
          className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-extrabold tracking-tight"
          style={{ background: soft(accent, 16), color: accent }}
        >
          {vm.avatarInit}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight text-[var(--color-brand-text-primary)]">{vm.name}</p>
          {subtitle ? <p className="truncate text-[13px] text-[var(--color-brand-text-muted)]">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2">
          <span className="font-mono-numbers text-[26px] font-bold leading-none tracking-[-0.5px] text-[var(--color-brand-text-primary)]">{fmtWhole(vm.remaining)}</span>
          <span className="text-[13px] text-[var(--color-brand-text-muted)]">
            {vm.currency} {owe ? t.leftSuffix : t.owedToYouSuffix}
          </span>
        </p>
        <div className="shrink-0 text-end">
          <p className="text-[12px] font-bold" style={{ color: dirTone }}>{owe ? t.iOwe : t.owedToMe}</p>
          {vm.gold ? (
            <p className="mt-0.5 font-mono-numbers text-[11px] font-semibold text-[var(--color-brand-gold)]">
              {vm.gold.grams.toFixed(1)}g · {vm.gold.karat}K
            </p>
          ) : null}
        </div>
      </div>

      <DebtBar pct={pct} tone={accent} className="mt-2.5" />
      <div className="mt-1.5 flex items-center justify-between gap-3 font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">
        <span className="truncate">{t.paidOfTotal(fmtWhole(vm.paid), fmtWhole(vm.total))}</span>
        <span className="shrink-0 text-[12px] font-bold" style={{ color: accent }}>{Math.round(pct)}%</span>
      </div>

      {vm.goal ? (
        <div className="mt-3 flex items-center gap-2 rounded-[11px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2.5 py-2">
          <Target className="h-4 w-4 shrink-0 text-[var(--color-brand-gold)]" aria-hidden />
          <p className="min-w-0 flex-1 truncate font-mono-numbers text-[12px] font-semibold text-[var(--color-brand-text-secondary)]">
            {t.goalSummary(fmtWhole(vm.goal.per), vm.goal.cadence, vm.goal.by)}
          </p>
          <span
            className="shrink-0 text-[11px] font-bold"
            style={{ color: vm.goal.onTrack ? 'var(--color-brand-green)' : 'var(--color-brand-amber)' }}
          >
            {vm.goal.onTrack ? t.onTrack : t.behind}
          </span>
        </div>
      ) : owe ? (
        <div className="mt-3 flex items-center gap-2 rounded-[11px] border border-dashed border-[var(--color-brand-border)] px-2.5 py-1.5">
          <Target className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
          <p className="min-w-0 flex-1 text-[12px] text-[var(--color-brand-text-muted)]">{t.fPayoffGoalHint}</p>
          <Button onClick={() => openGoalEdit(vm.id)} variant="outline" size="touch" className="shrink-0">
            {t.fPayoffGoal}
          </Button>
        </div>
      ) : null}

      <div className="mt-3 border-t border-[var(--color-brand-border)] pt-2.5">
        <Button onClick={onPay} variant={owe ? 'default' : 'success'} size="touch" className="w-full">
          {owe ? t.payPerson(vm.name) : t.logReceiptFrom(vm.name)}
        </Button>
      </div>
    </DebtCardFrame>
  )
}
