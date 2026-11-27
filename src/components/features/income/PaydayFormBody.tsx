'use client'

import { useMemo, useState } from 'react'
import { Calendar, Pencil } from 'lucide-react'
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
import { IconPickerSheet } from '@/components/features/goals/IconPickerSheet'
import { Card } from '@/components/ui/card'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { isGoalIconKey } from '@/lib/goals/goalVisual'
import { nextPaydays } from '@/lib/income/nextPaydays'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { usePaydaysLtCopy } from '@/lib/i18n/paydaysLtCopy'
import { microClassName } from '@/lib/ui/microLabelStyle'
import type { Currency, IncomeRecurringFrequency, IncomeSourceType, PaymentMethod } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'
import { formatWhole } from '@/lib/utils/formatters'
import { paydaysPerMonth } from '@/lib/utils/paydaySchedule'

/** How often, as the form offers it: the three schedules, or Irregular (no fixed day, stored as `IncomeSource.irregular`). */
export type FormFrequency = IncomeRecurringFrequency | 'irregular'
const FREQS: FormFrequency[] = ['monthly', 'biweekly', 'weekly', 'irregular']

export interface PaydayFormBodyProps {
  amount: string
  onAmount: (v: string) => void
  currency: Currency
  onCurrency: (c: Currency) => void
  base: Currency
  rates: Record<string, number>
  frequency: FormFrequency
  onFrequency: (f: FormFrequency) => void
  paydays: number[]
  onPaydays: (days: number[]) => void
  name: string
  onName: (v: string) => void
  sourceType: IncomeSourceType
  onSourceType: (t: IncomeSourceType) => void
  typeLocked: boolean
  /** The icon picked for an Other source; unset = the type's own. */
  icon?: string
  onIcon: (icon: string) => void
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
  const { locale } = useLocale()
  const weekendFirst = useWeekendFirstDay()
  const [dayOpen, setDayOpen] = useState(false)
  const [iconOpen, setIconOpen] = useState(false)
  const salary = p.sourceType === 'salary'
  const other = p.sourceType === 'other'
  const irregular = p.frequency === 'irregular'
  const schedule: IncomeRecurringFrequency = p.frequency === 'irregular' ? 'monthly' : p.frequency
  const amt = parseFloat(p.amount)
  const monthly = amt > 0 ? amt * paydaysPerMonth(schedule) : 0
  const line = irregular
    ? f.aboutMonth
    : !(amt > 0)
    ? (salary ? f.eachSalary : f.eachTime)
    : p.currency === p.base
      ? c.aboutMonth(formatWhole(monthly))
      : c.atRate(formatWhole(convertCurrency(monthly, p.currency, p.base, p.rates)), p.base)
  const tone = incomeTypeColors(p.sourceType)
  const dayLabel = salary ? c.payday : f.arrivesOn
  const upcoming = useMemo(
    () => nextPaydays({ frequency: schedule, paydays: p.paydays, irregular }, new Date(), 3, weekendFirst),
    [schedule, p.paydays, irregular, weekendFirst],
  )
  const tile = (
    <span aria-hidden className="flex size-16 items-center justify-center rounded-[19px] [&_svg]:size-7" style={{ background: tone.bg, color: tone.fg }}>
      <IncomeTypeIcon type={p.sourceType} icon={p.icon} />
    </span>
  )

  return (
    <div className="flex flex-col gap-4 pt-1">
      {p.typeLocked ? null : <IncomeTypeChipSlider value={p.sourceType} onChange={p.onSourceType} labels={t.income} otherIcon={p.icon} />}
      <AmountHero
        value={p.amount}
        onChange={p.onAmount}
        currency={p.currency}
        onCurrencyChange={(code) => p.onCurrency(code as Currency)}
        base={p.base}
        aria-label={schedule !== 'monthly' ? t.addIncome.amountPerPaycheckLabel : t.addIncome.labelAmount}
        top={
          <div className="flex w-full flex-col items-center">
            {/* The Add goal C tile: the icon can be changed only for Other. */}
            {other ? (
              <button data-raw-button-ok="the editable icon tile of the Add goal C top"
                type="button"
                onClick={() => setIconOpen(true)}
                aria-label={f.iconAriaOther}
                className="relative flex size-16 items-center justify-center rounded-[19px]"
              >
                {tile}
                <span aria-hidden className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full border-2 border-[var(--color-brand-card)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">
                  <Pencil className="size-3" />
                </span>
              </button>
            ) : tile}
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
        <SegmentedControl<FormFrequency>
          ariaLabel={f.howOften}
          value={p.frequency}
          onChange={p.onFrequency}
          options={FREQS.map((fr) => ({
            value: fr,
            label: fr === 'monthly' ? t.addIncome.freqMonthly : fr === 'biweekly' ? t.addIncome.freqBiweekly : fr === 'weekly' ? t.addIncome.freqWeekly : f.irregular,
          }))}
        />
      </div>

      <SheetGroup>
        {p.frequency === 'monthly' ? (
          <PickerRow label={dayLabel} chevron={false} onClick={() => setDayOpen(true)} value={<Pill icon={<Calendar />}>{day.everyMonth(p.paydays[0] ?? 1)}</Pill>} />
        ) : null}
        <MethodPickerRow label={c.receivedIn} value={p.paymentMethodId} onChange={p.onPaymentMethod} paymentMethods={p.paymentMethods} accountsOnly />
      </SheetGroup>

      {p.frequency === 'biweekly' || p.frequency === 'weekly' ? (
        <div>
          <p className="mb-2 px-1 text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.paydayHelper(p.frequency === 'biweekly' ? 2 : 4)}</p>
          <IncomePaydayGrid frequency={p.frequency} days={p.paydays} onChange={p.onPaydays} />
        </div>
      ) : null}

      {/* Next dates (or, for irregular, how it works): what buddget will expect from this source. */}
      <div>
        <h3 className={`${microClassName} mb-2 px-1`}>{irregular ? f.howItWorks : salary ? f.nextSalaries : f.nextDates}</h3>
        <Card className="p-4">
          {irregular ? (
            <p className="text-[0.8125rem] leading-relaxed text-[var(--color-brand-text-secondary)]">{f.irregularBody}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {upcoming.map((d) => <Pill key={d.toISOString()} icon={<Calendar />}>{formatLocalized(d, 'EEE, MMM d', locale)}</Pill>)}
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">{f.previewNote}</p>
            </>
          )}
        </Card>
      </div>

      <IconPickerSheet
        open={iconOpen}
        value={isGoalIconKey(p.icon) ? p.icon : null}
        onChange={p.onIcon}
        onClose={() => setIconOpen(false)}
        subtitle={f.iconSub}
        note={f.iconNote}
      />
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
