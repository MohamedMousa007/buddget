'use client'

import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { AmountHero } from '@/components/ui/AmountHero'
import { DayOfMonthSheet } from '@/components/ui/DayOfMonthSheet'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup } from '@/components/features/debts/lt/SheetParts'
import { IncomePaydayGrid } from '@/components/features/income/IncomePaydayGrid'
import { IncomeTypeChipSlider } from '@/components/features/income/IncomeTypeChipSlider'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { usePaydaysLtCopy } from '@/lib/i18n/paydaysLtCopy'
import { microClassName } from '@/lib/ui/microLabelStyle'
import type { Currency, IncomeRecurringFrequency, IncomeSourceType, PaymentMethod } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { formatWhole } from '@/lib/utils/formatters'
import { paydaysPerMonth } from '@/lib/utils/paydaySchedule'

const FREQS: IncomeRecurringFrequency[] = ['monthly', 'biweekly', 'weekly']

export interface PaydayFormBodyProps {
  amount: string
  onAmount: (v: string) => void
  currency: Currency
  onCurrency: (c: Currency) => void
  base: Currency
  rates: Record<string, number>
  frequency: IncomeRecurringFrequency
  onFrequency: (f: IncomeRecurringFrequency) => void
  paydays: number[]
  onPaydays: (days: number[]) => void
  name: string
  onName: (v: string) => void
  sourceType: IncomeSourceType
  onSourceType: (t: IncomeSourceType) => void
  typeLocked: boolean
  paymentMethodId: string
  onPaymentMethod: (id: string) => void
  paymentMethods: PaymentMethod[]
}

/**
 * Add income source (round 9): the Add goal C top (type chips with icons, the type's tile and the name, the amount), then how
 * often, the day (Salary day for a salary, Arrives on otherwise; several days for bi-weekly and weekly) and the account it goes into.
 */
export function PaydayFormBody(p: PaydayFormBodyProps) {
  const t = useT()
  const c = useDebtsSubsLtCopy().payday
  const f = usePaydaysLtCopy().form
  const day = useLightTouchCopy().dayOfMonth
  const [dayOpen, setDayOpen] = useState(false)
  const salary = p.sourceType === 'salary'
  const amt = parseFloat(p.amount)
  const monthly = amt > 0 ? amt * paydaysPerMonth(p.frequency) : 0
  const line = !(amt > 0)
    ? (salary ? f.eachSalary : f.eachTime)
    : p.currency === p.base
      ? c.aboutMonth(formatWhole(monthly))
      : c.atRate(formatWhole(convertCurrency(monthly, p.currency, p.base, p.rates)), p.base)
  const tone = incomeTypeColors(p.sourceType)
  const dayLabel = salary ? c.payday : f.arrivesOn

  return (
    <div className="flex flex-col gap-4 pt-1">
      {p.typeLocked ? null : <IncomeTypeChipSlider value={p.sourceType} onChange={p.onSourceType} labels={t.income} />}
      <AmountHero
        value={p.amount}
        onChange={p.onAmount}
        currency={p.currency}
        onCurrencyChange={(code) => p.onCurrency(code as Currency)}
        base={p.base}
        aria-label={p.frequency !== 'monthly' ? t.addIncome.amountPerPaycheckLabel : t.addIncome.labelAmount}
        top={
          <div className="flex w-full flex-col items-center">
            <span aria-hidden className="flex size-16 items-center justify-center rounded-[19px] [&_svg]:size-7" style={{ background: tone.bg, color: tone.fg }}>
              <IncomeTypeIcon type={p.sourceType} />
            </span>
            <input
              value={p.name}
              onChange={(e) => p.onName(e.target.value)}
              placeholder={c.namePh}
              aria-label={f.nameAria}
              dir="auto"
              className="mt-3 h-11 w-full bg-transparent text-center text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] outline-none placeholder:text-[var(--color-brand-text-muted)]"
            />
          </div>
        }
        line={line}
        className="px-0 pb-0"
      />

      <div>
        <h3 className={`${microClassName} mb-2 px-1`}>{f.howOften}</h3>
        <SegmentedControl<IncomeRecurringFrequency>
          ariaLabel={f.howOften}
          value={p.frequency}
          onChange={p.onFrequency}
          options={FREQS.map((fr) => ({
            value: fr,
            label: fr === 'monthly' ? t.addIncome.freqMonthly : fr === 'biweekly' ? t.addIncome.freqBiweekly : t.addIncome.freqWeekly,
          }))}
        />
      </div>

      <SheetGroup>
        {p.frequency === 'monthly' ? (
          <PickerRow label={dayLabel} chevron={false} onClick={() => setDayOpen(true)} value={<Pill icon={<Calendar />}>{day.everyMonth(p.paydays[0] ?? 1)}</Pill>} />
        ) : null}
        <MethodPickerRow label={c.receivedIn} value={p.paymentMethodId} onChange={p.onPaymentMethod} paymentMethods={p.paymentMethods} accountsOnly />
      </SheetGroup>

      {p.frequency !== 'monthly' ? (
        <div>
          <p className="mb-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.paydayHelper(p.frequency === 'biweekly' ? 2 : 4)}</p>
          <IncomePaydayGrid frequency={p.frequency} days={p.paydays} onChange={p.onPaydays} />
        </div>
      ) : null}

      <DayOfMonthSheet
        open={dayOpen}
        value={p.paydays[0] ?? null}
        onChange={(d) => p.onPaydays([d])}
        onClose={() => setDayOpen(false)}
        title={dayLabel}
        zIndexClassName="z-[110]"
      />
    </div>
  )
}
