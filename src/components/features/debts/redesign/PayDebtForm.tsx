'use client'

import { Input } from '@/components/ui/input'
import { Repeat, Users } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import { AmountCurrencyRow } from '@/components/features/savings-v3/MoneySheetParts'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { defaultColorForPaymentMethodType, decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { accountIdentifier } from '@/components/features/accounts/accountDisplay'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/store/types'
import { fmtWhole, soft } from './heroCardShared'
import { OptionChip } from '@/components/ui/OptionChip'
import { Switch } from '@/components/ui/switch'

const MICRO = 'font-semibold text-[10px] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'

/** "Make a payment" — handoff pay modal. */
export function PayDebtForm({ d }: { d: AddDebtHook }) {
  const dict = useT()
  const t = dict.debts
  const debt = d.selectedDebt
  const owedLabel = debt?.direction === 'they_owe' ? t.fOwedToYou : t.fYouOwe
  const accent = debt?.direction === 'they_owe' ? 'var(--color-brand-green)' : debt?.isGold ? 'var(--color-brand-gold)' : 'var(--color-brand-red)'
  const initial = (debt?.name || debt?.person || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex flex-col gap-[18px] pt-1">
      {/* Summary card */}
      {debt ? (
        <div className="flex items-center gap-3 rounded-[16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold" style={{ background: soft(accent, 16), color: accent }}>
            {debt.debtType === 'personal' || debt.debtType === 'general' ? initial : <Users className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-[var(--color-brand-text-primary)]">{debt.name || debt.person}</p>
            <p className="mt-0.5 font-mono-numbers text-[12px] text-[var(--color-brand-text-muted)]">
              {t.fPayLine(owedLabel, fmtWhole(d.selectedRemaining), debt.currency)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Amount */}
      <div>
        <AmountCurrencyRow
          amount={d.paymentAmount}
          onAmount={(v) => { d.setPaymentAmount(v); d.setPaymentRateError('') }}
          currency={d.paymentCurrency as Currency}
          onCurrency={(c) => { d.setPaymentCurrency(c); d.setPaymentRateError('') }}
          amountLabel={t.fAmount}
          currencyLabel={dict.moneyFlows.currency}
          includeGold={debt?.isGold}
        />
        {d.paymentPreview() ? <p className="mt-2 px-0.5 font-mono-numbers text-[12px] text-[var(--color-brand-text-muted)]">{d.paymentPreview()}</p> : null}
        {d.paymentRateError ? <p role="alert" className="mt-2 px-0.5 text-[12px] text-[var(--color-brand-red)]">{d.paymentRateError}</p> : null}
      </div>

      {/* Date */}
      <div>
        <div className={`${MICRO} mb-2`}>{d.paymentScheduleMode === 'recurring' ? t.fNextDue : t.fDate}</div>
        <DatePickerField value={d.paymentDate} onChange={d.setPaymentDate} />
      </div>

      {/* Payment method — horizontal chips */}
      <div>
        <div className={`${MICRO} mb-2`}>{t.fPaymentMethod}</div>
        <div className="native-scroll -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {d.paymentMethods.map((m) => {
            const on = d.paymentMethodId === m.id
            const c = m.color || defaultColorForPaymentMethodType(m.type)
            const Icon = paymentTypeIcon(m.type)
            return (
              <OptionChip
                key={m.id}
                selected={on}
                onClick={() => d.setPaymentMethodId(m.id)}
                className="h-11"
                style={on
                  ? { background: soft(accent, 14), borderColor: soft(accent, 60), color: 'var(--color-brand-text-primary)' }
                  : undefined}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: soft(c, 18), color: c }}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {decomposePaymentMethodName(m.name, m.last4).provider}
                {accountIdentifier(m) ? <span className="font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">{accountIdentifier(m)}</span> : null}
              </OptionChip>
            )
          })}
        </div>
      </div>

      {/* Recurring toggle-card */}
      <div className="flex items-center gap-3 rounded-[16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4 text-start">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]">
          <Repeat className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">{t.fRecurring}</span>
          <span className="mt-0.5 block text-[12px] text-[var(--color-brand-text-muted)]">{t.fRecurringHint}</span>
        </span>
        <Switch
          size="touch"
          aria-label={t.fRecurring}
          checked={d.paymentScheduleMode === 'recurring'}
          onCheckedChange={(on) => d.setPaymentScheduleMode(on ? 'recurring' : 'one_time')}
        />
      </div>

      {/* Notes */}
      <div>
        <div className={`${MICRO} mb-2`}>{t.fNotes}</div>
        <Input size="brand" value={d.paymentNotes} onChange={(e) => d.setPaymentNotes(e.target.value)} placeholder={t.fOptionalNote} />
      </div>
    </div>
  )
}
