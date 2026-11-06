'use client'

import { intlTag } from '@/lib/i18n/dateFormat'
import { Check, Coins } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { AmountField } from '@/components/ui/AmountField'
import { OptionChip } from '@/components/ui/OptionChip'
import { SelectableCard } from '@/components/ui/SelectableCard'
import type { useNewGoalForm } from '@/hooks/useNewGoalForm'
import { useLocale, useT } from '@/lib/i18n'
import { projectedFinish } from '@/lib/goals/goalPlan'
import { formatCurrency } from '@/lib/utils/formatters'
import { Badge } from '@/components/ui/badge'

type NewForm = ReturnType<typeof useNewGoalForm>
/** The slice of the form step 3 reads, so the goal detail's funding editor can reuse it. */
export type FundingForm = Pick<
  NewForm,
  | 'fundingMode' | 'setFundingMode' | 'sharePct' | 'fixedAmount' | 'setFixedAmount'
  | 'currency' | 'frequency' | 'basis' | 'usualKeep' | 'otherShare' | 'name' | 'targetAmount' | 'alreadySaved' | 'now'
> & { setSharePct: (n: number) => void }
type Form = FundingForm

const num = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0)

/** Everything step 3 and its pinned footer say, derived once from the form. */
export function useFundCopy(form: Form) {
  const t = useT().goals.flow.s3
  const { locale } = useLocale()
  const quarterly = form.frequency === 'quarterly'
  const periodMul = quarterly ? 3 : 1
  const money = (n: number) => formatCurrency(Math.round(n), form.currency, false)
  const month = (iso: string | null) =>
    iso ? new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(intlTag(locale), { month: 'short', year: 'numeric' }) : ''
  const remaining = Math.max(0, num(form.targetAmount) - num(form.alreadySaved))
  const keep = form.usualKeep
  const perPeriodAt = (pct: number) => (keep ? (keep * periodMul * pct) / 100 : 0)
  const finishAt = (pct: number) => projectedFinish(remaining, perPeriodAt(pct), form.frequency, form.now)
  const result = keep ? Math.round((keep * form.sharePct) / 100) : 0
  const total = form.otherShare + form.sharePct
  const sc = form.basis.scenario

  const pill = sc === 'A' ? t.pillA : sc === 'B' ? t.pillB : t.pillC
  const base = sc === 'A' ? t.baseA(money(keep ?? 0)) : sc === 'B' ? t.baseB(money(keep ?? 0)) : t.baseC
  const resultLine = sc === 'A' ? t.resultA(money(result)) : sc === 'B' ? t.resultB(money(result)) : t.resultC
  const totalLine = total > 100 ? t.totalOver(total) : sc === 'C' ? t.totalC : t.totalA(total, 100 - total)
  const fixedPer = num(form.fixedAmount)
  const fixedFinish = projectedFinish(remaining, fixedPer, form.frequency, form.now)

  const tip =
    form.fundingMode === 'manual'
      ? t.tipManual
      : form.fundingMode === 'fixed'
        ? fixedFinish ? t.tipFixed(month(fixedFinish)) : t.tipManual
        : sc === 'A' || form.sharePct === 100
          ? finishAt(form.sharePct) ? t.tipA(month(finishAt(form.sharePct))) : t.tipC
          : sc === 'B' && finishAt(form.sharePct)
            ? t.tipB(String(form.sharePct), month(finishAt(form.sharePct)), month(finishAt(100)), String(form.sharePct))
            : t.tipC

  const pocket = t.pocketName(form.name.trim() || '')
  const per = quarterly ? t.perQuarter : t.perMonth
  const summary =
    form.fundingMode === 'share' && keep
      ? t.summaryShare(money(result), form.name)
      : form.fundingMode === 'fixed' && fixedPer > 0
        ? `${money(fixedPer)} ${per}`
        : t.summaryNone(form.name)

  return { t, pill, base, resultLine, totalLine, tip, pocket, summary, result, money }
}

export function StepFundIt({ form, existing = false, onOpenSplit }: { form: Form; existing?: boolean; onOpenSplit?: () => void }) {
  const c = useFundCopy(form)
  const { t } = c
  const mode = form.fundingMode
  const set = form.setFundingMode
  const aria = c.t.sliderText(form.sharePct, c.money(c.result))

  return (
    <>
      {existing ? null : (
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{t.title}</h2>
          <p className="mt-1 text-sm text-[var(--color-brand-text-secondary)]">{t.sub(form.name)}</p>
        </div>
      )}
      <Badge tone="ink" size="md" bordered={false} className="gap-1.5">
        <Check className="size-3.5 text-[var(--color-brand-primary-bright)]" aria-hidden />
        {c.pill}
      </Badge>
      {existing ? null : (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-brand-border)] px-3.5 py-3 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
          <Coins className="size-5 shrink-0 text-[var(--color-brand-primary-bright)]" aria-hidden />
          <p>
            {t.pocketLead} <b className="text-[var(--color-brand-text-primary)]">{c.pocket}</b> {t.pocketTail}
          </p>
        </div>
      )}

      <div role="radiogroup" aria-label={t.title} className="flex flex-col gap-2.5">
        <SelectableCard selected={mode === 'share'} onClick={() => set('share')} className="min-h-14 flex-col items-stretch gap-3 rounded-[20px] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-start">
              <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.share}</p>
              <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.shareSub}</p>
            </div>
            <span className="font-mono-numbers text-[22px] font-semibold text-[var(--color-brand-primary-ink)]">{form.sharePct}%</span>
          </div>
          {mode === 'share' ? (
            <div className="flex flex-col gap-2.5 text-start" onClick={(e) => e.stopPropagation()}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.sharePct}
                onChange={(e) => form.setSharePct(Number(e.target.value))}
                aria-label={t.share}
                aria-valuetext={aria}
                className="h-11 w-full accent-[var(--color-brand-primary)]"
              />
              <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.base}</p>
              <p className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.resultLine}</p>
              <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.totalLine}</p>
              {onOpenSplit && form.otherShare > 0 ? (
                <OptionChip size="sm" onClick={onOpenSplit} className="w-fit">
                  {form.otherShare + form.sharePct}%
                </OptionChip>
              ) : null}
            </div>
          ) : null}
        </SelectableCard>

        <SelectableCard selected={mode === 'fixed'} onClick={() => set('fixed')} className="min-h-14 flex-col items-stretch gap-3">
          <div className="text-start">
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.fixed}</p>
            <p className="text-xs text-[var(--color-brand-text-secondary)]">
              {form.frequency === 'quarterly' ? t.fixedQuarterly : t.fixedMonthly}
            </p>
          </div>
          {mode === 'fixed' ? (
            <div onClick={(e) => e.stopPropagation()}>
              <AmountField value={form.fixedAmount} onChange={form.setFixedAmount} currency={form.currency} aria-label={t.fixedAmount} className="h-[52px] rounded-[14px] bg-[var(--color-brand-card)]" />
            </div>
          ) : null}
        </SelectableCard>

        <SelectableCard selected={mode === 'manual'} onClick={() => set('manual')} className="min-h-14 flex-col items-start gap-0.5">
          <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.manual}</p>
          <p className="text-xs text-[var(--color-brand-text-secondary)]">{t.manualSub}</p>
        </SelectableCard>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3.5">
        <BuddgyIcon size={24} />
        <p className="text-[0.8125rem] leading-[1.45] text-[var(--color-brand-text-primary)]">{c.tip}</p>
      </div>
    </>
  )
}
