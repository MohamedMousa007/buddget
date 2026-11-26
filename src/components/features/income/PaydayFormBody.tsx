'use client'

import { useState } from 'react'
import { Briefcase, Calendar } from 'lucide-react'
import { AmountHero } from '@/components/ui/AmountHero'
import { DayOfMonthSheet } from '@/components/ui/DayOfMonthSheet'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup, TextRow } from '@/components/features/debts/lt/SheetParts'
import { IncomePaydayGrid } from '@/components/features/income/IncomePaydayGrid'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { MANUAL_INCOME_SOURCE_TYPES } from '@/lib/constants/incomeSourceTypes'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
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
 * New / edit payday (Light touch `s_payday`): the amount with its currency (changeable), how often, then Name · Type ·
 * Payday (a 1–31 grid; several days for bi-weekly and weekly) · Received in.
 */
export function PaydayFormBody(p: PaydayFormBodyProps) {
  const t = useT()
  const c = useDebtsSubsLtCopy().payday
  const day = useLightTouchCopy().dayOfMonth
  const [sheet, setSheet] = useState<'type' | 'day' | null>(null)
  const amt = parseFloat(p.amount)
  const monthly = amt > 0 ? amt * paydaysPerMonth(p.frequency) : 0
  const line = !(amt > 0)
    ? ''
    : p.currency === p.base
      ? c.aboutMonth(formatWhole(monthly))
      : c.atRate(formatWhole(convertCurrency(monthly, p.currency, p.base, p.rates)), p.base)
  const tone = 'var(--color-brand-green)'

  return (
    <div className="flex flex-col gap-4 pt-1">
      <AmountHero
        value={p.amount}
        onChange={p.onAmount}
        currency={p.currency}
        onCurrencyChange={(code) => p.onCurrency(code as Currency)}
        base={p.base}
        aria-label={p.frequency !== 'monthly' ? t.addIncome.amountPerPaycheckLabel : t.addIncome.labelAmount}
        top={
          <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl [&_svg]:size-6" style={{ background: `color-mix(in oklab, ${tone} 14%, transparent)`, color: tone }}>
            <Briefcase />
          </span>
        }
        line={line}
        className="px-0 pb-0"
      />

      <SegmentedControl<IncomeRecurringFrequency>
        ariaLabel={t.addIncome.howOftenLabel}
        value={p.frequency}
        onChange={p.onFrequency}
        options={FREQS.map((f) => ({
          value: f,
          label: f === 'monthly' ? t.addIncome.freqMonthly : f === 'biweekly' ? t.addIncome.freqBiweekly : t.addIncome.freqWeekly,
        }))}
      />

      <SheetGroup>
        <TextRow label={c.name} value={p.name} onChange={p.onName} placeholder={c.namePh} />
        <PickerRow
          label={c.type}
          chevron={false}
          onClick={p.typeLocked ? undefined : () => setSheet('type')}
          value={<Pill>{incomeSourceTypeLabel(t.income, p.sourceType)}</Pill>}
        />
        {p.frequency === 'monthly' ? (
          <PickerRow label={c.payday} chevron={false} onClick={() => setSheet('day')} value={<Pill icon={<Calendar />}>{day.everyMonth(p.paydays[0] ?? 1)}</Pill>} />
        ) : null}
        <MethodPickerRow label={c.receivedIn} value={p.paymentMethodId} onChange={p.onPaymentMethod} paymentMethods={p.paymentMethods} accountsOnly />
      </SheetGroup>

      {p.frequency !== 'monthly' ? (
        <div>
          <p className="mb-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.paydayHelper(p.frequency === 'biweekly' ? 2 : 4)}</p>
          <IncomePaydayGrid frequency={p.frequency} days={p.paydays} onChange={p.onPaydays} />
        </div>
      ) : null}

      <OptionSheet<IncomeSourceType>
        open={sheet === 'type'}
        onClose={() => setSheet(null)}
        title={c.typeTitle}
        value={p.sourceType}
        onChange={p.onSourceType}
        options={MANUAL_INCOME_SOURCE_TYPES.map((st) => ({
          value: st,
          title: incomeSourceTypeLabel(t.income, st),
          icon: <IncomeTypeIcon type={st} />,
          tone: incomeTypeColors(st).fg,
        }))}
        zIndexClassName="z-[110]"
      />
      <DayOfMonthSheet
        open={sheet === 'day'}
        value={p.paydays[0] ?? null}
        onChange={(d) => p.onPaydays([d])}
        onClose={() => setSheet(null)}
        title={c.payday}
        zIndexClassName="z-[110]"
      />
    </div>
  )
}
