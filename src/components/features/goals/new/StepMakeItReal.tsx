'use client'

import { useState } from 'react'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'
import { CategoryGlyph } from '@/components/dashboard/CategoryIcon'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { CostSheet } from '@/components/features/goals/new/CostSheet'
import { CounselorCard } from '@/components/features/goals/new/CounselorCard'
import { DateStepper } from '@/components/features/goals/new/DateStepper'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { FiatCurrencyField } from '@/components/ui/CurrencyField'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectField } from '@/components/ui/SelectField'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { goalVisual } from '@/lib/goals/goalVisual'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { useNewGoalForm } from '@/hooks/useNewGoalForm'
import { useT } from '@/lib/i18n'
import { formatCurrency } from '@/lib/utils/formatters'

type Form = ReturnType<typeof useNewGoalForm>

/** Save-for categories that are often really a loan or installment being paid off. */
const DEBT_LIKE: ReadonlySet<string> = new Set(['car', 'house', 'education', 'phone_device', 'wedding', 'business'])

const FIELD = 'h-[52px] rounded-[14px] bg-[var(--color-brand-elevated)]'
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{children}</span>
)

export function StepMakeItReal({ form }: { form: Form }) {
  const t = useT()
  const f = t.goals.flow.s2
  const adv = t.goals.flow.advice
  const { online } = useNetworkStatus()
  const [costOpen, setCostOpen] = useState(false)
  const { icon: Icon, cat } = goalVisual(form.category)
  const categoryLabel = t.goals[goalCategoryLabelKey(form.category)] as string

  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-[14px]"
          style={{ color: `var(--color-cat-${cat})`, background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))` }}
          aria-hidden
        >
          <Icon className="size-6" />
        </span>
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{f.title}</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)]">{f.sub}</p>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <Label>{f.name}</Label>
        <Input size="brand" value={form.name} onChange={(e) => form.setName(e.target.value)} className="rounded-[14px] bg-[var(--color-brand-elevated)]" />
      </label>

      {form.kind === 'save' ? (
        <>
          {DEBT_LIKE.has(form.category) && form.linkable.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-brand-border)] p-3">
              <p className="text-[13px] font-semibold text-[var(--color-brand-text-primary)]">{f.linkLead}</p>
              <p className="text-xs text-[var(--color-brand-text-secondary)]">{f.linkSub}</p>
              <div className="flex flex-wrap gap-2">
                {form.linkable.slice(0, 4).map((d) => (
                  <OptionChip key={d.id} size="sm" onClick={() => form.linkInstead(d.id, d.name)}>
                    {d.name}
                  </OptionChip>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label>{f.targetDate}</Label>
            <DateStepper value={form.targetDate} now={form.now} onChange={form.setTargetDate} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{f.target}</Label>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <AmountField value={form.targetAmount} onChange={form.setTargetAmount} className={FIELD} aria-label={f.target} />
              </div>
              <div className="shrink-0">
                <FiatCurrencyField value={form.currency} onChange={form.setCurrency} compact className={FIELD} />
              </div>
            </div>
            {form.advice ? (
              <p className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary-soft)] px-3 py-2 text-[13px] text-[var(--color-brand-text-primary)]">
                <BuddgyIcon size={20} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  {form.advice.kind === 'covered' ? adv.covered : adv.emergency(formatCurrency(form.advice.amount, form.currency, false))}
                </span>
                {form.advice.kind === 'emergency' ? (
                  <OptionChip size="sm" onClick={() => form.setTargetAmount(String((form.advice as { amount: number }).amount))}>
                    {adv.use}
                  </OptionChip>
                ) : null}
              </p>
            ) : null}
            {online ? (
              <Button variant="link" size="touch" onClick={() => setCostOpen(true)} className="justify-start px-0 text-[13px]">
                <BuddgyIcon size={20} />
                {f.askBuddgy}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{f.save}</Label>
            <SegmentedControl<'monthly' | 'quarterly'>
              ariaLabel={f.save}
              size="field"
              value={form.frequency}
              onChange={form.setFrequency}
              options={[
                { value: 'monthly', label: f.monthly },
                { value: 'quarterly', label: f.quarterly },
              ]}
            />
          </div>
          <CounselorCard
            pace={form.pace}
            usualKeep={form.usualKeep}
            frequency={form.frequency}
            currency={form.currency}
            targetDate={form.targetDate}
            onUseDate={form.setTargetDate}
            onUseTarget={(n) => form.setTargetAmount(String(n))}
          />
          <div className="flex flex-col gap-1.5">
            <Label>
              {f.alreadySaved} <span className="font-normal text-[var(--color-brand-text-muted)]">· {f.optional}</span>
            </Label>
            <AmountField value={form.alreadySaved} onChange={form.setAlreadySaved} currency={form.currency} className={FIELD} aria-label={f.alreadySaved} />
          </div>
          <CostSheet
            open={costOpen}
            name={form.name}
            categoryLabel={categoryLabel}
            currency={form.currency}
            onUse={(n) => form.setTargetAmount(String(n))}
            onClose={() => setCostOpen(false)}
          />
        </>
      ) : form.kind === 'limit' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{f.limit}</Label>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <AmountField value={form.limit} onChange={form.setLimit} className={FIELD} aria-label={f.limit} />
              </div>
              <div className="shrink-0">
                <FiatCurrencyField value={form.currency} onChange={form.setCurrency} compact className={FIELD} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{f.appliesTo}</Label>
            <SelectField
              value={form.spendingCategory}
              onChange={form.setSpendingCategory}
              items={[
                { value: '', label: t.goals.allSpending },
                ...EXPENSE_ENTRY_CATEGORIES.map((c) => ({
                  value: c,
                  label: t.expenseForm.categoryLabels[c] ?? c,
                  glyph: <CategoryGlyph category={c} className="size-4" />,
                })),
              ]}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Label>{f.debts}</Label>
          {form.activeDebts.length === form.activeDebts.filter((d) => form.tracked.has(d.id)).length ? (
            <p className="text-sm text-[var(--color-brand-text-secondary)]">{f.noDebts}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {form.activeDebts.map((d) => {
              const taken = form.tracked.has(d.id)
              return (
                <OptionChip
                  key={d.id}
                  size="sm"
                  disabled={taken}
                  title={taken ? f.debtTracked : undefined}
                  selected={form.linkedDebtIds.includes(d.id)}
                  onClick={() => form.toggleDebt(d.id)}
                >
                  {d.name}
                </OptionChip>
              )
            })}
          </div>
          <p className="text-xs text-[var(--color-brand-text-secondary)]">
            {f.debtsTotal}: <b className="font-mono-numbers">{formatCurrency(form.debtsOwed, form.baseCurrency, false)}</b>
          </p>
        </div>
      )}
    </>
  )
}
