'use client'

import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { useTypedAmount } from '@/hooks/useTypedAmount'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { SelectField } from '@/components/ui/SelectField'
import { Switch } from '@/components/ui/switch'
import { BrandTile } from './BrandTile'
import { FieldLabel } from './SheetFrame'
import { currencyLabel } from './subscriptionLabels'
import { TRACKING_ICON } from './subscriptionLabels'
import type { AddSubscriptionFormReturn } from '@/hooks/useAddSubscriptionForm'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { decomposePaymentMethodName } from '@/lib/payment/paymentMethodDefaults'
import { addCategoryOf } from '@/lib/subscriptions/catalogDisplay'
import { useLocale, useT } from '@/lib/i18n'
import type { SubscriptionBillingCycle, SubscriptionTracking } from '@/lib/store/types'
import { cn } from '@/lib/utils'
import { formatFixed2, formatWhole } from '@/lib/utils/formatters'

const FIELD = 'h-12 rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] font-mono-numbers text-[17px] font-semibold'
const TRACKING: SubscriptionTracking[] = ['sms', 'ask', 'log']
const CYCLES: SubscriptionBillingCycle[] = ['weekly', 'monthly', 'quarterly', 'semiannual', 'yearly']

/** Step 2 (and Edit): plan, amount, dates, payment, tracking, reminder, and a collapsed More. */
export function AddConfigureStep({ form }: { form: AddSubscriptionFormReturn }) {
  const t = useT()
  const { locale } = useLocale()
  const ui = t.subscriptions.ui
  const { draft, patch, brand, plans, planIndex } = form
  const [more, setMore] = useState(false)
  const [amountText, setAmountText] = useTypedAmount(draft.amount)
  const [shareText, setShareText] = useTypedAmount(draft.myShare ?? 0)
  const custom = brand === null

  const cycleItems = useMemo(() => CYCLES.map((c) => ({ value: c, label: ui.cycles[c] })), [ui.cycles])
  const categoryItems = useMemo(
    () => EXPENSE_ENTRY_CATEGORIES.map((c) => ({ value: c, label: t.expenseForm.categoryLabels[c] ?? c })),
    [t.expenseForm.categoryLabels],
  )

  const planPrice = (amount: number, currency: string | undefined, cycle: SubscriptionBillingCycle) => {
    const cur = currency ?? form.base
    const text = cur === 'USD' ? `$${formatFixed2(amount)}` : `${formatFixed2(amount)} ${currencyLabel(cur, locale)}`
    const suffix = { weekly: ui.add.perWeekShort, monthly: ui.add.perMonthShort, quarterly: ui.add.perQuarterShort, semiannual: ui.add.perHalfYearShort, yearly: ui.add.perYearShort }[cycle]
    return `${text} ${suffix}`
  }

  const headerNote = brand
    ? ui.add.billedIn(ui.add.categories[addCategoryOf(brand)], plans[planIndex]?.currency ?? draft.currency)
    : ''

  return (
    <>
      <div className="flex items-center gap-3">
        <BrandTile brandKey={draft.brandKey} name={draft.name || '?'} size={48} />
        <div className="min-w-0 flex-1">
          {custom ? (
            <Input
              size="brand"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={ui.add.serviceName}
              aria-label={ui.add.serviceName}
            />
          ) : (
            <>
              <div className="truncate text-base font-semibold text-[var(--color-brand-text-primary)]">{brand.name}</div>
              <div className="truncate text-xs text-[var(--color-brand-text-secondary)]">{headerNote}</div>
            </>
          )}
        </div>
      </div>

      {plans.length > 0 ? (
        <div role="radiogroup" aria-label={t.subscriptions.selectPlan} className="grid grid-cols-2 gap-2.5">
          {plans.map((p, i) => {
            const selected = i === planIndex
            return (
              <SelectableCard
                key={p.id}
                layout="stack"
                surface="card"
                selected={selected}
                onClick={() => form.pickPlan(p)}
                className={cn('min-h-11 gap-0.5 bg-[var(--color-brand-card)] p-3', selected && 'border-2 p-[11px]')}
              >
                <span className="flex items-center justify-between text-sm font-semibold text-[var(--color-brand-text-primary)]">
                  {p.name}
                  {selected ? <Check className="size-4 text-[var(--color-brand-primary-ink)]" strokeWidth={1.75} aria-hidden /> : null}
                </span>
                <span className="font-mono-numbers text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
                  {planPrice(p.amount, p.currency, p.cycle)}
                </span>
              </SelectableCard>
            )
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <FieldLabel>{ui.add.amount}</FieldLabel>
        <div className="flex gap-2">
          <AmountField
            value={amountText}
            onChange={(v) => {
              setAmountText(v)
              patch({ amount: Number.parseFloat(v.replace(',', '.')) || 0 })
            }}
            decimalsFor={draft.currency}
            aria-label={ui.add.amount}
            className={cn(FIELD, 'flex-1 px-3.5')}
          />
          <div className="w-[168px] shrink-0">
            {form.currencyChoices.length > 0 ? (
              <SegmentedControl
                size="field"
                ariaLabel={t.goals.currency}
                value={draft.currency}
                onChange={form.setCurrency}
                options={form.currencyChoices.map((c) => ({ value: c, label: c }))}
              />
            ) : (
              <FiatCurrencyField compact value={draft.currency} onChange={form.setCurrency} className="h-12 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm" />
            )}
          </div>
        </div>
        {form.fx ? (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-brand-text-secondary)]">
            <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">
              ≈ {formatWhole(form.fx.estimate)} {currencyLabel(form.base, locale)}
            </span>
            <span>{ui.add.fxRest(form.fx.rate.toFixed(2))}</span>
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{draft.trial ? ui.add.trialEnd : ui.add.firstCharge}</FieldLabel>
          <DatePickerField value={draft.firstCharge} onChange={(v) => patch({ firstCharge: v })} className="h-12 rounded-xl font-mono-numbers" />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>{ui.add.cycle}</FieldLabel>
          <SelectField
            value={draft.cycle}
            onChange={(v) => patch({ cycle: v as SubscriptionBillingCycle })}
            items={cycleItems}
            aria-label={ui.add.cycle}
          />
        </div>
      </div>

      {form.paymentMethods.length > 0 ? (
        <div className="flex flex-col gap-2">
          <FieldLabel>{ui.add.paidWith}</FieldLabel>
          <div role="group" aria-label={ui.add.paidWith} className="hide-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-6 md:px-6">
            {form.paymentMethods.map((m) => (
              <OptionChip key={m.id} size="sm" selected={draft.paymentMethodId === m.id} onClick={() => patch({ paymentMethodId: m.id })}>
                {decomposePaymentMethodName(m.name, m.last4).provider}
                {m.last4 ? <span className="font-mono-numbers">••{m.last4}</span> : null}
              </OptionChip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <FieldLabel>{ui.add.tracking}</FieldLabel>
        <div role="radiogroup" aria-label={ui.add.tracking} className="flex flex-col gap-2">
          {TRACKING.map((m) => {
            const Icon = TRACKING_ICON[m]
            const selected = draft.tracking === m
            return (
              <SelectableCard
                key={m}
                layout="row"
                surface="card"
                selected={selected}
                onClick={() => patch({ tracking: m })}
                className={cn('min-h-14 gap-3 bg-[var(--color-brand-card)] px-3 py-2.5', selected && 'border-2 px-[11px] py-[9px]')}
              >
                <Icon className="size-5 shrink-0 text-[var(--color-brand-text-secondary)]" strokeWidth={1.75} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{ui.tracking[m].name}</span>
                  <span className="text-xs text-[var(--color-brand-text-secondary)]">{ui.tracking[m].hint}</span>
                </span>
                {selected ? <Check className="size-[18px] text-[var(--color-brand-primary-ink)]" strokeWidth={1.75} aria-hidden /> : null}
              </SelectableCard>
            )
          })}
        </div>
      </div>

      <label className="flex min-h-12 items-center justify-between gap-3 text-sm font-medium text-[var(--color-brand-text-primary)]">
        {ui.add.remind}
        <Switch size="touch" checked={draft.reminder} onCheckedChange={(v) => patch({ reminder: v })} />
      </label>

      <div className="border-t border-[var(--color-brand-border)]">
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore(!more)}
          data-raw-button-ok="a disclosure row: label and chevron as one target"
          className="flex min-h-12 w-full items-center justify-between text-start text-sm font-medium text-[var(--color-brand-text-primary)]"
        >
          {ui.add.more}
          {more ? (
            <ChevronDown className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />
          ) : (
            <ChevronRight className="size-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
          )}
        </button>
        {more ? (
          <div className="flex flex-col gap-4 pb-2 pt-1">
            <label className="flex min-h-12 items-center justify-between gap-3 text-sm font-medium text-[var(--color-brand-text-primary)]">
              {ui.add.trialEnd}
              <Switch size="touch" checked={draft.trial} onCheckedChange={(v) => patch({ trial: v })} />
            </label>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{ui.add.sharedWith}</FieldLabel>
              <Input
                size="brand"
                value={draft.sharedWith.join(', ')}
                onChange={(e) => patch({ sharedWith: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                aria-label={ui.add.sharedWith}
              />
            </div>
            {draft.sharedWith.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <FieldLabel>{ui.add.myShare}</FieldLabel>
                <AmountField
                  value={shareText}
                  onChange={(v) => {
                    setShareText(v)
                    patch({ myShare: Number.parseFloat(v.replace(',', '.')) || null })
                  }}
                  decimalsFor={draft.currency}
                  aria-label={ui.add.myShare}
                  className={cn(FIELD, 'px-3.5')}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{ui.add.category}</FieldLabel>
              <SelectField value={draft.category} onChange={(v) => patch({ category: v })} items={categoryItems} aria-label={ui.add.category} />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{ui.add.notes}</FieldLabel>
              <Input size="brand" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} aria-label={ui.add.notes} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
