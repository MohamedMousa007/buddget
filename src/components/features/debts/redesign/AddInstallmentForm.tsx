'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency } from '@/lib/store/types'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { AmountField } from '@/components/ui/AmountField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { InstallmentProviderPickerSheet } from './InstallmentProviderPickerSheet'
import { ProviderBadge } from './ProviderBadge'
import { coarseProvider } from '@/lib/constants/installmentProviders'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { currencyFlag } from '@/lib/constants/currencyMeta'
import { FieldButton } from '@/components/ui/FieldButton'
import { OptionChip } from '@/components/ui/OptionChip'
import { useT } from '@/lib/i18n'

const MICRO = 'font-semibold text-[10px] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'
const FIELD = 'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none'

export function AddInstallmentForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const t = useT().debts
  const FREQS = [
    { v: 'weekly' as const, label: t.fWeekly },
    { v: 'monthly' as const, label: t.fMonthly },
    { v: 'quarterly' as const, label: t.fQuarterly },
  ]
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const [providerOpen, setProviderOpen] = useState(false)
  const [curOpen, setCurOpen] = useState(false)

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
              <span className="flex h-7 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-cat-6)]/20 text-[11px] font-extrabold text-[var(--color-cat-6)]">CC</span>
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
        <input value={d.installmentItemName} onChange={(e) => d.setInstallmentItemName(e.target.value)} placeholder={t.fItemPh} className={FIELD} />
      </div>

      {/* Total amount */}
      <div>
        <div className={`${MICRO} mb-2`}>{t.fTotalAmount}</div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><AmountField value={d.startingBalance} onChange={d.setStartingBalance} mode="decimal" placeholder="0" /></div>
          <FieldButton
            size="lg"
            onClick={() => setCurOpen(true)}
            className="w-auto shrink-0 gap-1.5 bg-[var(--color-brand-elevated)] px-3"
            valueClassName="font-mono-numbers text-[14px] font-bold"
            value={d.currency}
            icon={<span className="text-[18px] leading-none">{currencyFlag(d.currency as Currency)}</span>}
          />
        </div>
        <CurrencySheet open={curOpen} value={d.currency as Currency} base={d.settings.baseCurrency} onSelect={(c) => { d.setCurrency(c as Currency); setCurOpen(false) }} onClose={() => setCurOpen(false)} />
      </div>

      {/* Start date */}
      <div>
        <div className={`${MICRO} mb-2`}>{t.fStartDate}</div>
        <DatePickerField value={d.installmentStartDate} onChange={d.setInstallmentStartDate} />
      </div>

      {/* Count + frequency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={`${MICRO} mb-2`}>{t.fCount}</div>
          <AmountField value={d.installmentCount} onChange={d.setInstallmentCount} mode="integer" placeholder="12" />
        </div>
        <div>
          <div className={`${MICRO} mb-2`}>{t.fFrequency}</div>
          <div className="flex h-12 items-center gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-1">
            {FREQS.map((f) => {
              const on = d.installmentFrequency === f.v
              return (
                <OptionChip key={f.v} size="segment" selected={on} onClick={() => d.setInstallmentFrequency(f.v)} className="h-full text-[11px]">
                  {f.label}
                </OptionChip>
              )
            })}
          </div>
        </div>
      </div>

      {/* Per preview + no-interest note */}
      {d.installmentPreview != null ? (
        <div className="rounded-[14px] bg-[var(--color-brand-primary-soft)] px-4 py-3">
          <p className="font-mono-numbers text-[15px] font-bold text-[var(--color-brand-primary-ink)]">{t.fApprox(d.installmentPreview.toLocaleString(), d.currency, d.installmentFrequency === 'weekly' ? t.fPerWeek : d.installmentFrequency === 'quarterly' ? t.fPerQuarter : t.fPerMonth)}</p>
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-text-muted)]">{t.fNoInterest}</p>
        </div>
      ) : null}
    </div>
  )
}
