'use client'

import { Repeat, Users } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import { AmountField } from '@/components/ui/AmountField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { defaultColorForPaymentMethodType, decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { rgba } from '@/lib/utils/color'
import { fmtWhole } from './heroCardShared'

const MICRO = 'font-semibold text-[10px] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'
const FIELD = 'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none'

/** "Make a payment" — handoff pay modal. */
export function PayDebtForm({ d }: { d: AddDebtHook }) {
  const debt = d.selectedDebt
  const owedLabel = debt?.direction === 'they_owe' ? 'Owed to you' : 'You owe'
  const accent = debt?.direction === 'they_owe' ? '#1DB954' : debt?.isGold ? '#F5C842' : '#E50914'
  const initial = (debt?.name || debt?.person || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="flex flex-col gap-[18px] pt-1">
      {/* Summary card */}
      {debt ? (
        <div className="flex items-center gap-3 rounded-[16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold" style={{ background: rgba(accent, 0.16), color: accent }}>
            {debt.debtType === 'personal' || debt.debtType === 'general' ? initial : <Users className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-[var(--color-brand-text-primary)]">{debt.name || debt.person}</p>
            <p className="mt-0.5 font-mono-numbers text-[12px] text-[var(--color-brand-text-muted)]">
              {owedLabel} · {fmtWhole(d.selectedRemaining)} {debt.currency} left
            </p>
          </div>
        </div>
      ) : null}

      {/* Amount */}
      <div>
        <div className={`${MICRO} mb-2`}>Amount</div>
        <AmountField
          value={d.paymentAmount}
          onChange={(v) => { d.setPaymentAmount(v); d.setPaymentRateError('') }}
          mode="decimal"
          currency={String(d.paymentCurrency)}
        />
        {d.paymentPreview() ? <p className="mt-2 px-0.5 font-mono-numbers text-[12px] text-[var(--color-brand-text-muted)]">{d.paymentPreview()}</p> : null}
        {d.paymentRateError ? <p className="mt-2 px-0.5 text-[12px] text-[#FF6B6B]">{d.paymentRateError}</p> : null}
      </div>

      {/* Date */}
      <div>
        <div className={`${MICRO} mb-2`}>{d.paymentScheduleMode === 'recurring' ? 'Next due' : 'Date'}</div>
        <DatePickerField value={d.paymentDate} onChange={d.setPaymentDate} />
      </div>

      {/* Payment method — horizontal chips */}
      <div>
        <div className={`${MICRO} mb-2`}>Payment method</div>
        <div className="native-scroll -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {d.paymentMethods.map((m) => {
            const on = d.paymentMethodId === m.id
            const c = m.color || defaultColorForPaymentMethodType(m.type)
            const Icon = paymentTypeIcon(m.type)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => d.setPaymentMethodId(m.id)}
                className="flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors"
                style={on
                  ? { background: rgba(accent, 0.14), borderColor: rgba(accent, 0.6), color: 'var(--color-brand-text-primary)' }
                  : { background: 'var(--color-brand-elevated)', borderColor: 'var(--color-brand-border)', color: 'var(--color-brand-text-secondary)' }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: rgba(c, 0.18), color: c }}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {decomposePaymentMethodName(m.name, m.last4).provider}
                {m.last4 ? <span className="font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">••{m.last4}</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Recurring toggle-card */}
      <button
        type="button"
        onClick={() => d.setPaymentScheduleMode(d.paymentScheduleMode === 'recurring' ? 'one_time' : 'recurring')}
        className="flex items-center gap-3 rounded-[16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4 text-start"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]">
          <Repeat className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[var(--color-brand-text-primary)]">Recurring payment</span>
          <span className="mt-0.5 block text-[12px] text-[var(--color-brand-text-muted)]">Repeat every cycle automatically</span>
        </span>
        <span
          className="flex h-7 w-[46px] shrink-0 rounded-full p-[3px] transition-colors"
          style={{ background: d.paymentScheduleMode === 'recurring' ? '#E50914' : 'var(--color-brand-border)', justifyContent: d.paymentScheduleMode === 'recurring' ? 'flex-end' : 'flex-start' }}
        >
          <span className="block h-[22px] w-[22px] rounded-full bg-white" />
        </span>
      </button>

      {/* Notes */}
      <div>
        <div className={`${MICRO} mb-2`}>Notes</div>
        <input value={d.paymentNotes} onChange={(e) => d.setPaymentNotes(e.target.value)} placeholder="Optional note" className={FIELD} />
      </div>
    </div>
  )
}
