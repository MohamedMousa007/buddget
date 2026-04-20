'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/lib/i18n'
import { readI18n } from '@/components/features/onboarding/journey/cards/InfoCard'
import type { Currency, IncomeRecurringFrequency } from '@/lib/store/types'
import type {
  IncomeSourceDraft,
  PaymentMethodDraft,
} from '@/lib/onboarding/journeyTypes'

export interface IncomeSourceRowEditorProps {
  initial?: IncomeSourceDraft
  defaultCurrency: Currency
  /** PMs the user captured on the previous card — feeds the paymentMethod
   *  dropdown. If empty, the dropdown is hidden (income saves without a
   *  PM link; server column is nullable). */
  paymentMethods: ReadonlyArray<PaymentMethodDraft>
  onSave: (row: IncomeSourceDraft) => void
  onCancel: () => void
}

const FREQ_OPTIONS: Array<{ value: IncomeRecurringFrequency; labelKey: string }> = [
  { value: 'monthly', labelKey: 'onboarding.journey.freq.monthly' },
  { value: 'biweekly', labelKey: 'onboarding.journey.freq.biweekly' },
  { value: 'weekly', labelKey: 'onboarding.journey.freq.weekly' },
]

export function IncomeSourceRowEditor({
  initial,
  defaultCurrency,
  paymentMethods,
  onSave,
  onCancel,
}: IncomeSourceRowEditorProps) {
  const t = useT()

  const [name, setName] = useState(initial?.name ?? '')
  const [amountStr, setAmountStr] = useState(
    initial?.amount != null ? String(initial.amount) : '',
  )
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? defaultCurrency)
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? true)
  const [frequency, setFrequency] = useState<IncomeRecurringFrequency>(
    initial?.recurringFrequency ?? 'monthly',
  )
  const [paymentMethodClientDraftId, setPaymentMethodClientDraftId] = useState<string>(
    initial?.paymentMethodClientDraftId
      ?? paymentMethods.find((p) => p.isDefault)?.clientDraftId
      ?? paymentMethods[0]?.clientDraftId
      ?? '',
  )

  const freqItems: ReadonlyArray<SelectFieldOption> = FREQ_OPTIONS.map((o) => ({
    value: o.value,
    label: readI18n(t, o.labelKey),
  }))

  const pmItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      paymentMethods.map((p) => ({
        value: p.clientDraftId,
        label: `${p.name} · ${p.currency}`,
      })),
    [paymentMethods],
  )

  const amount = parseFloat(amountStr)
  const canSave = name.trim().length > 0 && Number.isFinite(amount) && amount > 0

  const save = () => {
    if (!canSave) return
    const draft: IncomeSourceDraft = {
      clientDraftId: initial?.clientDraftId ?? crypto.randomUUID(),
      name: name.trim(),
      amount,
      currency,
      isRecurring,
      recurringFrequency: isRecurring ? frequency : undefined,
      // The apply playbook (PR2) resolves this to a real paymentMethodId
      // after `addPaymentMethod` runs and returns concrete ids.
      ...(paymentMethodClientDraftId ? { paymentMethodClientDraftId } : {}),
    }
    onSave(draft)
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">
          {readI18n(t, 'onboarding.journey.incomeEditor.nameLabel')}
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={readI18n(t, 'onboarding.journey.incomeEditor.namePlaceholder')}
          autoFocus
          className="mt-1 h-10"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {readI18n(t, 'onboarding.journey.incomeEditor.amountLabel')}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            className="mt-1 h-10 font-mono-numbers"
          />
        </div>
        <div className="min-w-[6.5rem]">
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {readI18n(t, 'onboarding.journey.incomeEditor.currencyLabel')}
          </Label>
          <div className="mt-1">
            <FiatCurrencySelect value={currency} onChange={(v) => setCurrency(v)} />
          </div>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-brand-text-secondary)]">
          {readI18n(t, 'onboarding.journey.incomeEditor.recurringLabel')}
        </span>
        <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
      </label>

      {isRecurring ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {readI18n(t, 'onboarding.journey.incomeEditor.frequencyLabel')}
          </Label>
          <div className="mt-1">
            <SelectField
              value={frequency}
              onChange={(v) => setFrequency(v as IncomeRecurringFrequency)}
              items={freqItems}
              aria-label={readI18n(t, 'onboarding.journey.incomeEditor.frequencyLabel')}
            />
          </div>
        </div>
      ) : null}

      {pmItems.length > 0 ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {readI18n(t, 'onboarding.journey.incomeEditor.paymentMethodLabel')}
          </Label>
          <div className="mt-1">
            <SelectField
              value={paymentMethodClientDraftId}
              onChange={setPaymentMethodClientDraftId}
              items={pmItems}
              aria-label={readI18n(t, 'onboarding.journey.incomeEditor.paymentMethodLabel')}
            />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-brand-text-muted)]">
            {readI18n(t, 'onboarding.journey.incomeEditor.paymentMethodHint')}
          </p>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-lg text-sm font-medium text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)]"
        >
          {t.common.cancel ?? 'Cancel'}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="h-10 px-5 rounded-lg text-sm font-semibold text-white bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.common.save ?? 'Save'}
        </button>
      </div>
    </div>
  )
}
