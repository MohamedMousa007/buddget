'use client'

import { Landmark, Undo2 } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import { AmountHero } from '@/components/ui/AmountHero'
import { PickerRow } from '@/components/ui/PickerRow'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { NoteRow } from '@/components/features/savings-v3/MoneySheetParts'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup } from '@/components/features/debts/lt/SheetParts'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { formatFlex } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'

/** Record a payment (Light touch `debtpay`): icon tile, the signed amount, what is left after it, then Debt · Paid from · Repeat. */
export function PayDebtForm({ d }: { d: AddDebtHook }) {
  const dict = useT()
  const t = dict.debts
  const c = useDebtsSubsLtCopy().pay
  const ordinal = useLightTouchCopy().dayOfMonth.ordinal
  const debt = d.selectedDebt
  const receiving = debt ? isOwedToUser(debt) : false
  const tone = receiving ? 'var(--color-brand-green)' : 'var(--color-brand-primary)'
  const Icon = receiving ? Undo2 : Landmark
  const paid = parseFloat(d.paymentAmount)
  const sameUnit = debt ? d.paymentCurrency === (debt.isGold ? 'XAU' : debt.currency) : false
  const after = Math.max(0, d.selectedRemaining - (sameUnit && paid > 0 ? paid : 0))
  const unit = debt?.isGold ? ' g' : ''

  return (
    <div className="flex flex-col gap-4 pt-1">
      <AmountHero
        value={d.paymentAmount}
        onChange={(v) => { d.setPaymentAmount(v); d.setPaymentRateError('') }}
        currency={d.paymentCurrency}
        onCurrencyChange={(code) => { d.setPaymentCurrency(code); d.setPaymentRateError('') }}
        includeGold={debt?.isGold}
        base={d.settings.baseCurrency}
        sign={receiving ? '+' : '−'}
        aria-label={t.fAmount}
        top={
          <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl [&_svg]:size-6" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}>
            <Icon />
          </span>
        }
        line={d.paymentPreview() ?? ''}
        className="px-0 pb-0"
      />
      {debt ? (
        <div className="-mt-1 text-center">
          <p dir="auto" className="text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{debt.name || debt.person}</p>
          <p dir="auto" className="mt-0.5 font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
            {c.left(`${formatFlex(d.selectedRemaining)}${unit}`, `${formatFlex(after)}${unit}`)}
          </p>
        </div>
      ) : null}
      {d.paymentRateError ? <p role="alert" className="text-center text-xs text-[var(--color-brand-red)]">{d.paymentRateError}</p> : null}

      <SheetGroup>
        <PickerRow
          label={c.debt}
          onClick={d.isPayDebtFlow ? d.backToPayDebtList : undefined}
          value={<span dir="auto" className="truncate">{debt?.name || debt?.person}</span>}
        />
        <MethodPickerRow label={receiving ? c.into : c.paidFrom} value={d.paymentMethodId} onChange={d.setPaymentMethodId} paymentMethods={d.paymentMethods} />
        <SettingsSwitchRow
          label={c.repeat}
          hint={c.repeatHint(ordinal(Number(d.paymentDate.slice(8, 10))))}
          checked={d.paymentScheduleMode === 'recurring'}
          onChange={(on) => d.setPaymentScheduleMode(on ? 'recurring' : 'one_time')}
        />
      </SheetGroup>

      <NoteRow value={d.paymentNotes} onChange={d.setPaymentNotes} placeholder={c.note} />
    </div>
  )
}
