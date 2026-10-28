'use client'

import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { formatCurrency } from '@/lib/utils/formatters'
import { BuddgyHead, stepLead, stepTitle } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { useOnboarding } from './useOnboarding'
import { useOnboardingCopy } from './useOnboardingCopy'

const SAMPLE = [
  { share: 38, color: 'var(--color-cat-3)' },
  { share: 22, color: 'var(--color-cat-4)' },
  { share: 24, color: 'var(--color-cat-5)' },
  { share: 16, color: 'var(--color-cat-1)' },
]

/** Step 6: hand off to the budget studio, which already knows income, accounts and goals. */
export function StepBudget({ chrome }: { chrome: StepChrome }) {
  const c = useOnboardingCopy()
  const { record, finish } = useOnboarding()
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const income = useFinanceStore((s) => s.incomeSources.find((i) => i.id === record?.incomeSourceId))
  const accounts = useAccounts().accounts.length

  return (
    <JourneyFrame
      {...chrome}
      footer={
        <>
          <Button size="cta" className="w-full" onClick={() => finish(true)}>
            {c.budget.build}
          </Button>
          <Button variant="ghost" size="touch" className="w-full" onClick={() => finish(false)}>
            {c.budget.later}
          </Button>
        </>
      }
    >
      <BuddgyHead mood="happy" size={72} />
      <h1 className={`${stepTitle} mt-[18px]`}>{c.budget.title}</h1>
      <p className={stepLead}>{c.budget.lead}</p>

      <Card className="mt-5 flex flex-col gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-secondary)]">{c.budget.startFrom}</span>
        <div className="flex flex-wrap gap-2">
          {income ? <Chip>{c.budget.income(formatCurrency(income.amount, base, false))}</Chip> : null}
          {accounts > 0 ? <Chip>{c.budget.accounts(accounts)}</Chip> : null}
          {(record?.goals ?? []).map((g) => <Chip key={g}>{c.goals.options[g]}</Chip>)}
        </div>
        <div aria-hidden>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]">
            {SAMPLE.map((p, i) => <span key={i} className="block h-full" style={{ width: `${p.share}%`, background: p.color }} />)}
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-brand-text-muted)]">{c.budget.sample}</p>
        </div>
      </Card>

      <p className="mt-3.5 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--color-brand-text-muted)]">
        <Info className="mt-px size-4 shrink-0" aria-hidden />
        {c.budget.why}
      </p>
    </JourneyFrame>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-full bg-[var(--color-brand-primary-soft)] px-2.5 text-xs font-bold text-[var(--color-brand-primary-ink)]">{children}</span>
}
