'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { SubscriptionPlanPicker } from '@/components/features/subscriptions/SubscriptionPlanPicker'
import type { AddSubscriptionFormReturn } from '@/hooks/useAddSubscriptionForm'
import type { Dictionary } from '@/lib/i18n/types'
import type { SubscriptionBillingCycle } from '@/lib/store/types'
import { cn } from '@/lib/utils'

const inputClass =
  'rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]'

/**
 * Configure step: plan, amount, cycle, dates, payment method.
 */
export function AddSubscriptionConfigureView({
  form,
  t,
  selectClass,
}: {
  form: AddSubscriptionFormReturn
  t: Pick<Dictionary, 'subscriptions' | 'goals'>
  selectClass: string
}) {
  const cycleItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => [
      { value: 'weekly', label: t.subscriptions.billingWeekly },
      { value: 'monthly', label: t.subscriptions.billingMonthly },
      { value: 'quarterly', label: t.subscriptions.billingQuarterly },
      { value: 'yearly', label: t.subscriptions.billingYearly },
    ],
    [t.subscriptions],
  )

  return (
    <div className="space-y-4 px-6 pb-6">
      {(form.customMode || form.pickedBrand === 'custom') && (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.serviceName}</Label>
          <Input value={form.name} onChange={(e) => form.setName(e.target.value)} className={cn('mt-1', inputClass)} />
        </div>
      )}

      {form.plansForPicker.length > 0 ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.selectPlan}</Label>
          <div className="mt-2">
            <SubscriptionPlanPicker
              plans={form.plansForPicker}
              selectedIndex={form.planIndex}
              onSelect={form.onPlanIndexChange}
              currency={form.currency}
              brandColor={
                form.pickedBrand && form.pickedBrand !== 'custom' ? form.pickedBrand.color : '#64748b'
              }
              cycleLabels={{
                mo: t.subscriptions.perMonth,
                yr: t.subscriptions.perYear,
                wk: t.subscriptions.perWeek,
                qtr: t.subscriptions.perQuarter,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.amountLabel}</Label>
          <AmountField
            value={form.amountStr}
            onChange={form.setAmountStr}
            className={cn('mt-1', inputClass)}
          />
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">{t.subscriptions.adjustPriceHint}</p>
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.currency}</Label>
          <div className="mt-1">
            <FiatCurrencyField value={form.currency} onChange={form.setCurrency} className={selectClass} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.billingCycle}</Label>
          <SelectField
            value={form.billingCycle}
            onChange={(v) => form.setBillingCycle(v as SubscriptionBillingCycle)}
            items={cycleItems}
            className="mt-1"
            aria-label={t.subscriptions.billingCycle}
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.billingDay}</Label>
          <AmountField
            mode="integer"
            value={String(form.billingDay)}
            onChange={(v) => form.setBillingDay(Number(v))}
            className={cn('mt-1', inputClass)}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-1 block">{t.subscriptions.paymentMethod}</Label>
        <PaymentMethodPicker
          value={form.paymentMethodId}
          onChange={form.setPaymentMethodId}
          paymentMethods={form.paymentMethods}
        />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.notes}</Label>
        <Input value={form.notes} onChange={(e) => form.setNotes(e.target.value)} className={cn('mt-1', inputClass)} />
      </div>
    </div>
  )
}
