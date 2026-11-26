'use client'

import { ChevronDown, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { AmountHero } from '@/components/ui/AmountHero'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { SelectField } from '@/components/ui/SelectField'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup, TextRow } from '@/components/features/debts/lt/SheetParts'
import { useTypedAmount } from '@/hooks/useTypedAmount'
import type { AddSubscriptionFormReturn } from '@/hooks/useAddSubscriptionForm'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import type { Currency, SubscriptionBillingCycle } from '@/lib/store/types'
import { formatFixed2, formatWhole } from '@/lib/utils/formatters'
import { BrandTile } from './BrandTile'
import { FieldLabel } from './SheetFrame'

const CYCLES: SubscriptionBillingCycle[] = ['weekly', 'monthly', 'quarterly', 'semiannual', 'yearly']

/**
 * Step 2 and Edit (Light touch `s_subadd`): the logo and name over an editable price with its currency, the plan chips,
 * a note when the price is not the usual one, then First charge · Every · Paid with · Remind me. Tracking is automatic.
 */
export function AddConfigureStep({ form }: { form: AddSubscriptionFormReturn }) {
  const t = useT()
  const ui = t.subscriptions.ui
  const c = useDebtsSubsLtCopy().subs
  const { draft, patch, brand, plans, planIndex } = form
  const [more, setMore] = useState(false)
  const [everyOpen, setEveryOpen] = useState(false)
  const [amountText, setAmountText] = useTypedAmount(draft.amount)
  const [shareText, setShareText] = useTypedAmount(draft.myShare ?? 0)
  const custom = brand === null

  const categoryItems = useMemo(
    () => EXPENSE_ENTRY_CATEGORIES.map((x) => ({ value: x, label: t.expenseForm.categoryLabels[x] ?? x })),
    [t.expenseForm.categoryLabels],
  )

  const line = draft.trial ? '' : c.addLine(`${formatWhole(form.impact.monthly)} ${form.base}`, formatWhole(form.impact.after))

  return (
    <>
      <AmountHero
        value={amountText}
        onChange={(v) => {
          setAmountText(v)
          patch({ amount: Number.parseFloat(v.replace(',', '.')) || 0 })
        }}
        currency={draft.currency}
        onCurrencyChange={(code) => form.setCurrency(code as Currency)}
        codes={form.currencyChoices.length > 0 ? form.currencyChoices : undefined}
        base={form.base}
        aria-label={ui.add.amount}
        top={
          <div className="mt-1 flex flex-col items-center">
            <BrandTile brandKey={draft.brandKey} name={draft.name || '?'} size={72} />
            {custom ? null : <p dir="auto" className="mt-2.5 text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{brand.name}</p>}
          </div>
        }
        line={line}
        className="px-0 pb-0"
      />

      {plans.length > 1 ? (
        <div role="radiogroup" aria-label={t.subscriptions.selectPlan} className="flex flex-wrap justify-center gap-2">
          {plans.map((p, i) => (
            <OptionChip key={p.id} role="radio" aria-checked={i === planIndex} selected={i === planIndex} onClick={() => form.pickPlan(p)}>
              {p.name}
            </OptionChip>
          ))}
        </div>
      ) : null}

      {form.priceDiffers && form.planPrice != null ? (
        <p className="rounded-2xl bg-[var(--color-brand-primary-soft)] px-4 py-3 text-[0.8125rem] text-[var(--color-brand-text-primary)]">
          {c.priceNote(`${formatFixed2(form.planPrice)} ${draft.currency}`)}
        </p>
      ) : null}

      <SheetGroup note={c.trackedNote}>
        {custom ? <TextRow label={ui.add.serviceName} value={draft.name} onChange={(name) => patch({ name })} placeholder={ui.add.serviceName} /> : null}
        <PickerRow
          label={draft.trial ? ui.add.trialEnd : c.firstCharge}
          value={<DatePickerField look="pill" value={draft.firstCharge} onChange={(v) => patch({ firstCharge: v })} />}
        />
        <PickerRow label={c.every} value={<Pill icon={<Repeat />}>{ui.cycles[draft.cycle]}</Pill>} chevron={false} onClick={() => setEveryOpen(true)} />
        {form.paymentMethods.length > 0 ? (
          <MethodPickerRow label={c.paidWith} value={draft.paymentMethodId ?? ''} onChange={(id) => patch({ paymentMethodId: id })} paymentMethods={form.paymentMethods} />
        ) : null}
        <SettingsSwitchRow label={c.remind} hint={c.remindHelp} checked={draft.reminder} onChange={(v) => patch({ reminder: v })} />
      </SheetGroup>

      <SheetGroup>
        <PickerRow
          label={ui.add.more}
          aria-label={ui.add.more}
          onClick={() => setMore(!more)}
          chevron={false}
          value={<ChevronDown aria-hidden className={`size-4 text-[var(--color-brand-text-muted)] transition-transform ${more ? 'rotate-180' : ''}`} />}
          className="[&>span:first-child]:w-auto [&>span:first-child]:flex-1"
        />
        {more ? (
          <div className="flex flex-col gap-4 px-4 py-3">
            <SettingsSwitchRow label={ui.add.trialEnd} checked={draft.trial} onChange={(v) => patch({ trial: v })} />
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
      </SheetGroup>

      <OptionSheet<SubscriptionBillingCycle>
        open={everyOpen}
        onClose={() => setEveryOpen(false)}
        title={c.every}
        value={draft.cycle}
        onChange={(cycle) => patch({ cycle })}
        options={CYCLES.map((x) => ({ value: x, title: ui.cycles[x] }))}
        zIndexClassName="z-[110]"
      />
    </>
  )
}
