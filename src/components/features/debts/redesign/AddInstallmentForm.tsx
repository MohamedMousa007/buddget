'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency } from '@/lib/store/types'
import { AmountField } from '@/components/ui/AmountField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { FieldButton } from '@/components/ui/FieldButton'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { InstallmentProviderPickerSheet } from './InstallmentProviderPickerSheet'
import { ProviderBadge } from './ProviderBadge'
import { coarseProvider } from '@/lib/constants/installmentProviders'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { microClassName as MICRO } from '@/lib/ui/microLabelStyle'
import {
  lengthForPayments,
  paymentsForLength,
  totalFromPer,
  type PlanFrequency,
  type PlanLengthUnit,
} from '@/lib/debts/installmentPlan'
import { useT } from '@/lib/i18n'

type PlanMode = 'total' | 'installment'

export function AddInstallmentForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const dict = useT()
  const t = dict.debts
  const freqOptions = [
    { value: 'weekly' as const, label: t.fWeekly },
    { value: 'monthly' as const, label: t.fMonthly },
    { value: 'quarterly' as const, label: t.fQuarterly },
  ]
  const modeOptions = [
    { value: 'total' as const, label: t.fModeTotal },
    { value: 'installment' as const, label: t.fModeInstallment },
  ]
  const unitOptions = [
    { value: 'months' as const, label: t.fMonths },
    { value: 'years' as const, label: t.fYears },
  ]
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const [providerOpen, setProviderOpen] = useState(false)
  const [mode, setMode] = useState<PlanMode>('total')
  const [perStr, setPerStr] = useState('')
  const [lengthStr, setLengthStr] = useState('')
  const [unit, setUnit] = useState<PlanLengthUnit>('months')

  const frequency = d.installmentFrequency as PlanFrequency
  const count = parseInt(d.installmentCount, 10)
  const total = parseFloat(d.startingBalance)

  const pushTotal = (per: string, n: number) => {
    const p = parseFloat(per)
    d.setStartingBalance(p > 0 && n > 0 ? String(totalFromPer(p, n)) : '')
  }

  const switchMode = (next: PlanMode) => {
    if (next === 'installment') {
      setPerStr(total > 0 && count > 0 ? String(Math.round((total / count) * 100) / 100) : '')
      setLengthStr(count > 0 ? String(lengthForPayments(count, unit, frequency)) : '')
    }
    setMode(next)
  }

  const changePer = (v: string) => {
    setPerStr(v)
    pushTotal(v, count)
  }

  const changeLength = (v: string, u: PlanLengthUnit, f: PlanFrequency) => {
    setLengthStr(v)
    const len = parseFloat(v)
    const n = len > 0 ? paymentsForLength(len, u, f) : 0
    d.setInstallmentCount(n > 0 ? String(n) : '')
    pushTotal(perStr, n)
  }

  const changeFrequency = (f: PlanFrequency) => {
    d.setInstallmentFrequency(f)
    if (mode === 'installment') changeLength(lengthStr, unit, f)
  }

  const changeUnit = (u: PlanLengthUnit) => {
    setUnit(u)
    const len = parseFloat(lengthStr)
    if (!(len > 0)) return
    const converted = u === 'years' ? len / 12 : len * 12
    changeLength(String(Math.round(converted * 100) / 100), u, frequency)
  }

  const periodLabel = frequency === 'weekly' ? t.fPerWeek : frequency === 'quarterly' ? t.fPerQuarter : t.fPerMonth
  const summary =
    mode === 'total'
      ? d.installmentPreview != null ? t.fApprox(d.installmentPreview.toLocaleString('en-US'), d.currency, periodLabel) : '—'
      : total > 0 ? t.fTotalApprox(total.toLocaleString('en-US'), d.currency) : '—'

  const providerLabel =
    d.installmentProvider === 'credit_card'
      ? (d.creditCardDebts.find((c) => c.id === d.linkedCreditCardDebtId)?.name ?? t.debtTypeCreditCard)
      : d.installmentProviderName || t.chooseProvider

  return (
    <div className="flex flex-col gap-[18px] pt-1">
      {/* Provider (locked in Edit) */}
      <div>
        <div className={`${MICRO} mb-2 flex items-center gap-1.5`}>{t.fProvider} {locked ? <Lock className="h-3 w-3" /> : null}</div>
        <FieldButton
          disabled={locked}
          onClick={() => setProviderOpen(true)}
          className="bg-[var(--color-brand-elevated)] px-3 disabled:opacity-70"
          valueClassName="text-sm font-semibold"
          value={providerLabel}
          icon={
            d.installmentProvider === 'credit_card' ? (
              <span className="flex h-7 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-cat-6)]/20 text-[0.6875rem] font-extrabold text-[var(--color-cat-6)]">CC</span>
            ) : d.installmentProviderName ? (
              <ProviderBadge slug={d.installmentProviderSlug} name={d.installmentProviderName} size={28} />
            ) : null
          }
        />
        <InstallmentProviderPickerSheet
          open={providerOpen}
          valueSlug={d.installmentProviderSlug}
          valueCardId={d.installmentProvider === 'credit_card' ? d.linkedCreditCardDebtId : undefined}
          creditCards={d.creditCardDebts
            .map((cd) => {
              const pm = d.paymentMethods.find((m) => m.id === cd.linkedPaymentMethodId)
              return pm ? { debtId: cd.id, pm } : null
            })
            .filter((x): x is { debtId: string; pm: (typeof d.paymentMethods)[number] } => x !== null)}
          onPickBrand={(slug, name) => { d.setInstallmentProvider(coarseProvider(slug)); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(slug); d.setLinkedCreditCardDebtId('') }}
          onPickCard={(cardId, name) => { d.setInstallmentProvider('credit_card'); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(undefined); d.setLinkedCreditCardDebtId(cardId) }}
          onCustom={(name) => { d.setInstallmentProvider('other'); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(undefined); d.setLinkedCreditCardDebtId('') }}
          onAddCreditCard={() => setActiveModal('addCreditCard')}
          onClose={() => setProviderOpen(false)}
        />
      </div>

      {/* Item */}
      <div>
        <div className={`${MICRO} mb-2`}>{t.fItem}</div>
        <Input size="brand" value={d.installmentItemName} onChange={(e) => d.setInstallmentItemName(e.target.value)} placeholder={t.fItemPh} />
      </div>

      {/* Plan: two ways in, same stored fields (total, count, frequency). */}
      <SegmentedControl<PlanMode> options={modeOptions} value={mode} onChange={switchMode} ariaLabel={t.fModeAria} />

      <div>
        <div className={`${MICRO} mb-2`}>{mode === 'total' ? t.fTotalAmount : t.fPerPayment}</div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            {mode === 'total' ? (
              <AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" decimalsFor={d.currency} aria-label={t.fTotalAmount} placeholder="0" />
            ) : (
              <AmountField value={perStr} onChange={changePer} mode="decimal" decimalsFor={d.currency} aria-label={t.fPerPayment} placeholder="0" />
            )}
          </div>
          <CurrencyField
            compact
            value={d.currency}
            onChange={(c) => d.setCurrency(c as unknown as Currency)}
            disabled={d.currencyLocked}
            className="h-[52px] w-24 shrink-0 rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3"
          />
        </div>
        {d.currencyLocked ? <p className="mt-2 px-0.5 text-[0.75rem] text-[var(--color-brand-text-muted)]">{dict.moneyFlows.debtLocked}</p> : null}
      </div>

      <div>
        <div className={`${MICRO} mb-2`}>{t.fFrequency}</div>
        <SegmentedControl<PlanFrequency> options={freqOptions} value={frequency} onChange={changeFrequency} ariaLabel={t.fFrequency} />
      </div>

      {mode === 'total' ? (
        <div>
          <div className={`${MICRO} mb-2`}>{t.fCount}</div>
          <AmountField value={d.installmentCount} onChange={d.setInstallmentCount} mode="integer" aria-label={t.fCount} placeholder="12" />
        </div>
      ) : (
        <div>
          <div className={`${MICRO} mb-2`}>{t.fPlanLength}</div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <AmountField value={lengthStr} onChange={(v) => changeLength(v, unit, frequency)} mode="decimal" aria-label={t.fPlanLength} placeholder="12" />
            </div>
            <SegmentedControl<PlanLengthUnit> fill={false} options={unitOptions} value={unit} onChange={changeUnit} ariaLabel={t.fPlanLength} size="field" className="shrink-0" />
          </div>
        </div>
      )}

      <div>
        <div className={`${MICRO} mb-2`}>{t.fStartDate}</div>
        <DatePickerField value={d.installmentStartDate} onChange={d.setInstallmentStartDate} />
      </div>

      <div className="min-h-[68px] rounded-[14px] bg-[var(--color-brand-primary-soft)] px-4 py-3">
        <p className="font-mono-numbers text-[0.9375rem] font-bold text-[var(--color-brand-primary-ink)]">{summary}</p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--color-brand-text-muted)]">{t.fNoInterest}</p>
      </div>
    </div>
  )
}
