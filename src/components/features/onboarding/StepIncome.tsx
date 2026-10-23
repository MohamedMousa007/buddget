'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { useLocale } from '@/lib/i18n'
import { dailyAllowance } from '@/lib/onboarding/payday'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { BuddgyHead, stepLead, stepTitle } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { BandBar, RevealScreen } from './RevealScreen'
import { useOnboarding } from './useOnboarding'
import { useOnboardingCopy } from './useOnboardingCopy'

const QUICK_DAYS = [1, 15, 25, 28]
const DEFAULT_DAY = 25
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')
const clampDay = (n: number) => Math.min(31, Math.max(1, Math.round(n)))

/** Step 4: pay and payday. Creates one recurring income, then reveals the per-day number. */
export function StepIncome({ chrome }: { chrome: StepChrome }) {
  const c = useOnboardingCopy()
  const { locale } = useLocale()
  const { record, patch } = useOnboarding()
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const name = useFinanceStore((s) => s.profile.name)
  const existing = useFinanceStore((s) => s.incomeSources.find((i) => i.id === record?.incomeSourceId))
  const model = useAccounts()
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [day, setDay] = useState(existing?.dayOfMonth ?? DEFAULT_DAY)
  const [custom, setCustom] = useState(existing?.dayOfMonth && !QUICK_DAYS.includes(existing.dayOfMonth) ? String(existing.dayOfMonth) : '')
  const [steady, setSteady] = useState<'steady' | 'varies'>(useFinanceStore.getState().profile.financialProfile?.incomeStability === 'variable' ? 'varies' : 'steady')
  const [reveal, setReveal] = useState(false)
  const value = parseFloat(amount)
  const valid = Number.isFinite(value) && value > 0

  const save = () => {
    const s = useFinanceStore.getState()
    const data = {
      name: c.income.salary, amount: value, currency: base, isRecurring: true, recurringFrequency: 'monthly' as const,
      dayOfMonth: day, paydayDays: [day], sourceType: 'salary' as const,
    }
    if (existing) s.updateIncomeSource(existing.id, data)
    else {
      s.addIncomeSource(data)
      patch({ incomeSourceId: useFinanceStore.getState().incomeSources.at(-1)?.id })
    }
    // Read again: the record write above changed the profile this one builds on.
    const fresh = useFinanceStore.getState()
    fresh.updateProfile({ financialProfile: { ...fresh.profile.financialProfile, incomeStability: steady === 'varies' ? 'variable' : 'fixed' } })
    setReveal(true)
  }

  const noIncome = () => {
    useFinanceStore.getState().updateSettings({ noIncomeDeclared: true })
    chrome.next()
  }

  if (reveal) {
    const allowance = dailyAllowance(model.totalInBase, new Date(), day)
    const paydayLabel = allowance.payday.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    const today = allowance.days === 0
    return (
      <RevealScreen
        chrome={{ ...chrome, onBack: () => setReveal(false) }}
        label={c.reveal.label}
        chip={c.reveal.chip(allowance.days)}
        big={allowance.perDay !== null ? fmt(allowance.perDay) : fmt(model.totalInBase)}
        unit={allowance.perDay !== null ? c.reveal.unit(base) : base}
        bar={<BandBar parts={[{ share: Math.max(0.05, 1 - allowance.days / 31), color: 'var(--flow-band-fg)' }, { share: Math.min(0.95, allowance.days / 31), color: 'var(--flow-band-mix)' }]} />}
        cells={[
          { label: c.reveal.balance, value: fmt(model.totalInBase) },
          { label: c.reveal.payday, value: paydayLabel },
          { label: c.reveal.income, value: fmt(value) },
        ]}
        title={today ? c.reveal.todayTitle : c.reveal.title(name)}
        lead={today ? c.reveal.todayLead : c.reveal.lead}
        extra={
          <div className="mt-[18px] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 shadow-sm">
            <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{c.reveal.nextTitle}</p>
            <p className="mt-0.5 text-[13px] text-[var(--color-brand-text-secondary)]">{c.reveal.nextBody}</p>
          </div>
        }
        onContinue={chrome.next}
      />
    )
  }

  return (
    <JourneyFrame
      {...chrome}
      footer={
        <>
          <Button size="cta" className="w-full" disabled={!valid} onClick={save}>
            {c.cont}
          </Button>
          <Button variant="ghost" size="touch" className="w-full" onClick={noIncome}>
            {c.income.none}
          </Button>
        </>
      }
    >
      <BuddgyHead mood="curious" size={52} />
      <h1 className={`${stepTitle} mt-[18px]`}>{c.income.title}</h1>
      <p className={stepLead}>{c.income.lead}</p>

      <div className="mt-[22px] flex flex-col gap-5">
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.income.amountLabel}</span>
          <AmountField value={amount} onChange={setAmount} currency={base} placeholder="0" label={c.income.amountLabel} />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.income.dayLabel}</span>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_DAYS.map((d) => (
              <OptionChip key={d} as="trigger" size="md" selected={day === d} onClick={() => { setDay(d); setCustom('') }}>
                {d}
              </OptionChip>
            ))}
            <Input
              inputMode="numeric"
              maxLength={2}
              className="w-24"
              value={custom}
              placeholder={c.income.otherDay}
              aria-label={c.income.otherDay}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '')
                setCustom(digits)
                if (Number(digits) > 0) setDay(clampDay(Number(digits)))
              }}
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[var(--color-brand-text-secondary)]">{c.income.steadyLabel}</span>
          <SegmentedControl
            ariaLabel={c.income.steadyLabel}
            value={steady}
            onChange={setSteady}
            options={[{ value: 'steady', label: c.income.steady }, { value: 'varies', label: c.income.varies }]}
          />
          <p className="mt-1.5 px-1 text-xs text-[var(--color-brand-text-muted)]">{c.income.variesNote}</p>
        </div>
      </div>

      <p className="mt-3.5 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--color-brand-text-muted)]">
        <Info className="mt-px size-4 shrink-0" aria-hidden />
        {c.income.why}
      </p>
    </JourneyFrame>
  )
}
