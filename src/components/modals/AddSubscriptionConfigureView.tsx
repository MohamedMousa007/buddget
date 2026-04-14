'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FiatCurrencySelect } from '@/components/ui/FiatCurrencySelect'
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
  const cycleOptions: { v: SubscriptionBillingCycle; label: string }[] = [
    { v: 'weekly', label: t.subscriptions.billingWeekly },
    { v: 'monthly', label: t.subscriptions.billingMonthly },
    { v: 'quarterly', label: t.subscriptions.billingQuarterly },
    { v: 'yearly', label: t.subscriptions.billingYearly },
  ]

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
            />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.amountLabel}</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={form.amountStr}
            onChange={(e) => form.setAmountStr(e.target.value)}
            className={cn('mt-1', inputClass)}
          />
          <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-1">{t.subscriptions.adjustPriceHint}</p>
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.currency}</Label>
          <div className="mt-1">
            <FiatCurrencySelect value={form.currency} onChange={form.setCurrency} className={selectClass} />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[var(--color-brand-text-muted)]">{t.subscriptions.priceEstimateNote}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.billingCycle}</Label>
          <select
            value={form.billingCycle}
            onChange={(e) => form.setBillingCycle(e.target.value as SubscriptionBillingCycle)}
            className={cn('mt-1 w-full py-2 px-3', inputClass)}
          >
            {cycleOptions.map((o) => (
              <option key={o.v} value={o.v}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.billingDay}</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={form.billingDay}
            onChange={(e) => form.setBillingDay(Number(e.target.value))}
            className={cn('mt-1', inputClass)}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.startedOn}</Label>
        <Input
          type="date"
          value={form.startDate}
          onChange={(e) => form.setStartDate(e.target.value)}
          className={cn('mt-1', inputClass)}
        />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.subscriptions.paymentMethod}</Label>
        <select
          value={form.paymentMethodId}
          onChange={(e) => form.setPaymentMethodId(e.target.value)}
          className={cn('mt-1 w-full py-2 px-3', inputClass)}
        >
          {form.paymentMethods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.last4 ? ` ••${m.last4}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.goals.notes}</Label>
        <Input value={form.notes} onChange={(e) => form.setNotes(e.target.value)} className={cn('mt-1', inputClass)} />
      </div>
    </div>
  )
}
