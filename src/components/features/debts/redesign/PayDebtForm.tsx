'use client'

import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { DatePickerField } from '@/components/ui/DatePickerField'

const MICRO = 'font-semibold text-[10px] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'
const FIELD = 'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none'

/** Redesigned pay-debt form: summary + amount + date + method carousel + one-time/recurring + notes. */
export function PayDebtForm({ d }: { d: AddDebtHook }) {
  const debt = d.selectedDebt
  const preview = d.paymentPreview()

  return (
    <div className="flex flex-col gap-[18px] pt-1">
      {debt ? (
        <div className="rounded-[16px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">Paying</p>
          <p className="mt-1 text-[17px] font-bold text-[var(--color-brand-text-primary)]">{debt.name || debt.person}</p>
        </div>
      ) : null}

      {/* Schedule toggle */}
      <div className="flex h-11 items-center gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-1">
        {(['one_time', 'recurring'] as const).map((m) => {
          const on = d.paymentScheduleMode === m
          return (
            <button key={m} type="button" onClick={() => d.setPaymentScheduleMode(m)} className="h-full flex-1 rounded-lg text-[13px] font-semibold transition-colors" style={on ? { background: 'var(--color-brand-card)', color: 'var(--color-brand-text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,.3)' } : { color: 'var(--color-brand-text-muted)' }}>
              {m === 'one_time' ? 'One-time' : 'Recurring'}
            </button>
          )
        })}
      </div>

      {/* Amount */}
      <div>
        <div className={`${MICRO} mb-2`}>Amount</div>
        <input
          value={d.paymentAmount}
          onChange={(e) => { d.setPaymentAmount(e.target.value.replace(/[^\d.]/g, '')); d.setPaymentRateError('') }}
          inputMode="decimal"
          placeholder="0"
          className={`${FIELD} font-mono-numbers`}
        />
        {preview ? <p className="mt-2 px-0.5 font-mono-numbers text-[12px] text-[var(--color-brand-text-muted)]">{preview}</p> : null}
        {d.paymentRateError ? <p className="mt-2 px-0.5 text-[12px] text-[#FF6B6B]">{d.paymentRateError}</p> : null}
      </div>

      {/* Date */}
      <div>
        <div className={`${MICRO} mb-2`}>{d.paymentScheduleMode === 'recurring' ? 'Next due' : 'Date'}</div>
        <DatePickerField value={d.paymentDate} onChange={d.setPaymentDate} />
      </div>

      {/* Method carousel */}
      <PaymentMethodPicker label="Paid via" value={d.paymentMethodId} onChange={d.setPaymentMethodId} paymentMethods={d.paymentMethods} />

      {/* Notes */}
      <div>
        <div className={`${MICRO} mb-2`}>Notes</div>
        <input value={d.paymentNotes} onChange={(e) => d.setPaymentNotes(e.target.value)} placeholder="Optional" className={FIELD} />
      </div>
    </div>
  )
}
