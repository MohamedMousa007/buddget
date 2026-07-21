'use client'

import { useState } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import type { AddDebtHook } from '@/hooks/useAddDebtSheet'
import type { Currency } from '@/lib/store/types'
import { CurrencySheet } from '@/components/ui/CurrencySheet'
import { InstallmentProviderPickerSheet } from './InstallmentProviderPickerSheet'
import { ProviderBadge } from './ProviderBadge'
import { coarseProvider } from '@/lib/constants/installmentProviders'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { currencyFlag } from '@/lib/constants/currencyMeta'

const MICRO = 'font-semibold text-[10px] tracking-[0.08em] uppercase text-[var(--color-brand-text-muted)]'
const FIELD = 'h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 text-[15px] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] outline-none'
const FREQS = [
  { v: 'weekly' as const, label: 'Weekly' },
  { v: 'monthly' as const, label: 'Monthly' },
  { v: 'quarterly' as const, label: 'Quarterly' },
]

export function AddInstallmentForm({ d, locked = false }: { d: AddDebtHook; locked?: boolean }) {
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const [providerOpen, setProviderOpen] = useState(false)
  const [curOpen, setCurOpen] = useState(false)

  const providerLabel =
    d.installmentProvider === 'credit_card'
      ? (d.creditCardDebts.find((c) => c.id === d.linkedCreditCardDebtId)?.name ?? 'Credit card')
      : d.installmentProviderName || 'Choose provider'

  return (
    <div className="flex flex-col gap-[18px] pt-1">
      {/* Provider (locked in Edit) */}
      <div>
        <div className={`${MICRO} mb-2 flex items-center gap-1.5`}>Provider {locked ? <Lock className="h-3 w-3" /> : null}</div>
        <button type="button" disabled={locked} onClick={() => setProviderOpen(true)} className="flex h-12 w-full items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-start disabled:opacity-70">
          {d.installmentProvider === 'credit_card' ? (
            <span className="flex h-7 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#8A5CF6]/22 text-[11px] font-extrabold text-[#8A5CF6]">CC</span>
          ) : d.installmentProviderName ? (
            <ProviderBadge slug={d.installmentProviderSlug} name={d.installmentProviderName} size={28} />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{providerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
        </button>
        <InstallmentProviderPickerSheet
          open={providerOpen}
          valueSlug={d.installmentProviderSlug}
          valueCardId={d.installmentProvider === 'credit_card' ? d.linkedCreditCardDebtId : undefined}
          creditCardDebts={d.creditCardDebts}
          onPickBrand={(slug, name) => { d.setInstallmentProvider(coarseProvider(slug)); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(slug); d.setLinkedCreditCardDebtId('') }}
          onPickCard={(cardId, name) => { d.setInstallmentProvider('credit_card'); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(undefined); d.setLinkedCreditCardDebtId(cardId) }}
          onCustom={(name) => { d.setInstallmentProvider('other'); d.setInstallmentProviderName(name); d.setInstallmentProviderSlug(undefined); d.setLinkedCreditCardDebtId('') }}
          onAddCreditCard={() => setActiveModal('addCreditCard')}
          onClose={() => setProviderOpen(false)}
        />
      </div>

      {/* Item */}
      <div>
        <div className={`${MICRO} mb-2`}>Item</div>
        <input value={d.installmentItemName} onChange={(e) => d.setInstallmentItemName(e.target.value)} placeholder="e.g. iPhone 16" className={FIELD} />
      </div>

      {/* Total amount */}
      <div>
        <div className={`${MICRO} mb-2`}>Total amount</div>
        <div className="flex gap-2">
          <input value={d.startingBalance} onChange={(e) => d.setStartingBalance(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0" className={`${FIELD} flex-1 font-mono-numbers`} />
          <button type="button" onClick={() => setCurOpen(true)} className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3">
            <span className="text-[18px] leading-none">{currencyFlag(d.currency as Currency)}</span>
            <span className="font-mono-numbers text-[14px] font-bold text-[var(--color-brand-text-primary)]">{d.currency}</span>
            <ChevronDown className="h-4 w-4 text-[var(--color-brand-text-muted)]" />
          </button>
        </div>
        <CurrencySheet open={curOpen} value={d.currency as Currency} base={d.settings.baseCurrency} onSelect={(c) => { d.setCurrency(c as Currency); setCurOpen(false) }} onClose={() => setCurOpen(false)} />
      </div>

      {/* Count + frequency */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={`${MICRO} mb-2`}># of installments</div>
          <input value={d.installmentCount} onChange={(e) => d.setInstallmentCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="12" className={`${FIELD} font-mono-numbers`} />
        </div>
        <div>
          <div className={`${MICRO} mb-2`}>Frequency</div>
          <div className="flex h-12 items-center gap-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-1">
            {FREQS.map((f) => {
              const on = d.installmentFrequency === f.v
              return (
                <button key={f.v} type="button" onClick={() => d.setInstallmentFrequency(f.v)} className="h-full flex-1 rounded-lg text-[11px] font-semibold transition-colors" style={on ? { background: '#00C2A81f', color: '#2CE0C6' } : { color: 'var(--color-brand-text-muted)' }}>
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Per preview + no-interest note */}
      {d.installmentPreview != null ? (
        <div className="rounded-[14px] bg-[#00C2A80d] px-4 py-3">
          <p className="font-mono-numbers text-[15px] font-bold text-[#2CE0C6]">≈ {d.installmentPreview.toLocaleString()} {d.currency} / {d.installmentFrequency === 'weekly' ? 'week' : d.installmentFrequency === 'quarterly' ? 'quarter' : 'month'}</p>
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-text-muted)]">Fixed amounts only — no interest.</p>
        </div>
      ) : null}
    </div>
  )
}
