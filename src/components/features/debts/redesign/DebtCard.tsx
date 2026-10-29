'use client'

import { parseISO } from 'date-fns'
import { CreditCard as CardIcon, Receipt, Target } from 'lucide-react'
import type { BorrowVM, CreditCardVM, InstallmentVM } from '@/hooks/useDebtTabData'
import { DebtBar, DebtCardFrame, EditPin, fmtWhole, readable, soft } from './heroCardShared'
import { ProviderBadge } from './ProviderBadge'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'

type Actions = { onEdit: () => void; onDelete?: () => void; onPay: () => void }

export type DebtCardProps =
  | ({ kind: 'borrow'; vm: BorrowVM } & Actions)
  | ({ kind: 'card'; vm: CreditCardVM; onCharges: () => void } & Actions)
  | ({ kind: 'installment'; vm: InstallmentVM } & Actions)

/** Initials chip + title/subtitle row shared by the borrow and credit-card cards. */
function IdentityRow({ color, initials, title, subtitle, monoSubtitle }: {
  color: string
  initials: string
  title: string
  subtitle?: string
  monoSubtitle?: boolean
}) {
  return (
    <div className="flex items-center gap-3 pe-9">
      <span
        className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-extrabold tracking-tight"
        style={{ background: soft(color, 16), color }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold leading-tight text-[var(--color-brand-text-primary)]">{title}</p>
        {subtitle ? <p className={`truncate text-[13px] text-[var(--color-brand-text-muted)] ${monoSubtitle ? 'font-mono-numbers' : ''}`}>{subtitle}</p> : null}
      </div>
    </div>
  )
}

/** The big whole-number figure with its trailing unit/suffix. */
function Amount({ value, unit, large }: { value: number; unit: string; large?: boolean }) {
  return (
    <p className={`flex items-baseline gap-2 ${large ? 'mt-1' : ''}`}>
      <span className={`font-mono-numbers font-bold leading-none text-[var(--color-brand-text-primary)] ${large ? 'text-[32px] tracking-[-1px]' : 'text-[26px] tracking-[-0.5px]'}`}>{fmtWhole(value)}</span>
      <span className={`${large ? 'text-sm' : 'text-[13px]'} text-[var(--color-brand-text-muted)]`}>{unit}</span>
    </p>
  )
}

function BorrowBody({ vm, onEdit, onDelete, onPay }: { vm: BorrowVM } & Actions) {
  const t = useT().debts
  const openGoalEdit = useSettingsStore((s) => s.openDebtGoalEdit)
  const owe = vm.dir === 'owe'
  const pct = vm.total > 0 ? (vm.paid / vm.total) * 100 : 0
  const accent = vm.accent
  const dirTone = owe ? 'var(--color-brand-red)' : 'var(--color-brand-green)'
  const subtitle = vm.person && vm.person !== vm.name ? vm.person : vm.relation

  return (
    <>
      <EditPin onClick={onEdit} onDelete={onDelete} label={t.editDebtAria} deleteLabel={t.deleteDebtLabel} deleteBody={t.deleteDebtBody} />
      <IdentityRow color={accent} initials={vm.avatarInit} title={vm.name} subtitle={subtitle || undefined} />

      <div className="mt-3 flex items-end justify-between gap-3">
        <Amount value={vm.remaining} unit={`${vm.currency} ${owe ? t.leftSuffix : t.owedToYouSuffix}`} />
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
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[11px] border border-dashed border-[var(--color-brand-border)] px-2.5 py-1.5">
          <Target className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
          <p className="min-w-[8rem] flex-1 text-[12px] text-[var(--color-brand-text-muted)]">{t.fPayoffGoalHint}</p>
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
    </>
  )
}

function cardBarTone(utilPct: number | null): string {
  if (utilPct == null) return 'var(--color-cat-6)'
  if (utilPct < 30) return 'var(--color-brand-green)'
  if (utilPct <= 100) return 'var(--color-brand-amber)'
  return 'var(--color-brand-red)'
}

const STAT_LABEL = 'truncate text-[9.5px] font-bold uppercase tracking-[0.04em] text-[var(--color-brand-text-muted)]'
const STAT_BOX = 'rounded-[11px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-2.5 py-2'
const STAT_VALUE = 'mt-0.5 font-mono-numbers text-[14px] font-bold leading-tight text-[var(--color-brand-text-primary)]'

function CardBody({ vm, onEdit, onDelete, onPay, onCharges }: { vm: CreditCardVM; onCharges: () => void } & Actions) {
  const t = useT().debts
  const { locale } = useLocale()
  const over = vm.overBy > 0
  const tone = cardBarTone(vm.utilPct)

  return (
    <>
      <EditPin onClick={onEdit} onDelete={onDelete} label={t.editCardAria} deleteLabel={t.deleteCardLabel} deleteBody={t.deleteCardBody} />
      <IdentityRow color={vm.color} initials={vm.initials} title={vm.bank} subtitle={`${vm.last4 ? `••${vm.last4}` : '••••'} · ${t.cardSuffixDebt}`} monoSubtitle />

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{t.outstandingShort}</p>
          <div className="mt-0.5"><Amount value={vm.outstanding} unit={vm.currency} /></div>
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
    </>
  )
}

function InstallmentBody({ vm, onEdit, onDelete, onPay }: { vm: InstallmentVM } & Actions) {
  const t = useT().debts
  const accent = readable(vm.brandColor)
  const segments = Array.from({ length: Math.max(vm.count, 1) }, (_, i) => (i < vm.paid ? 'paid' : i === vm.paid ? 'next' : 'todo'))

  return (
    <>
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
          <Amount value={vm.remaining} unit={vm.currency} large />
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
    </>
  )
}

/** The one debt carousel card: `kind` picks the borrow, credit-card or installment body over the shared frame, kebab, identity row and amount. */
export function DebtCard(props: DebtCardProps) {
  return (
    <DebtCardFrame>
      {props.kind === 'borrow' ? <BorrowBody {...props} /> : props.kind === 'card' ? <CardBody {...props} /> : <InstallmentBody {...props} />}
    </DebtCardFrame>
  )
}
