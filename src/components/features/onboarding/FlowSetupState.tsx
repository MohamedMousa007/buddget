'use client'

import { useState, type ReactNode } from 'react'
import { Calendar, Check, ChevronRight, MessageSquare, Plus, SlidersHorizontal, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { useSetupProgress, type SetupStepId } from '@/hooks/useSetupProgress'
import { dailyAllowance } from '@/lib/onboarding/payday'
import { navigate } from '@/lib/navigation/navigate'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { cn } from '@/lib/utils'
import { BuddgyHead } from './BuddgyHead'
import { useOnboarding } from './useOnboarding'
import { useOnboardingCopy } from './useOnboardingCopy'

const ICONS: Record<SetupStepId, typeof Wallet> = { accounts: Wallet, sms: MessageSquare, payday: Calendar, budget: SlidersHorizontal, expense: Plus }
const MINUTES: Record<SetupStepId, number> = { accounts: 1, sms: 2, payday: 1, budget: 2, expense: 1 }
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

/**
 * What an empty Flow shows a new account. With accounts and payday in, it leads with the per-day number and the first
 * expense; otherwise it picks up the setup where it stopped and lists the rest. Same steps as the setup checklist.
 */
export function FlowSetupState({ className }: { className?: string }) {
  const c = useOnboardingCopy()
  const { steps, doneCount } = useSetupProgress()
  const { record, resume } = useOnboarding()
  const model = useAccounts()
  const name = useFinanceStore((s) => s.profile.name)
  const base = useFinanceStore((s) => s.settings.baseCurrency)
  const payday = useFinanceStore((s) => s.incomeSources.find((i) => i.isRecurring)?.dayOfMonth)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const [open, setOpen] = useState(false)

  const done = new Set(steps.filter((s) => s.done).map((s) => s.id))
  const todo = steps.filter((s) => !s.done)
  const rowCopy: Record<SetupStepId, { title: string; sub: string }> = {
    accounts: c.flow.accountsRow, sms: c.flow.smsRow, payday: c.flow.paydayRow, budget: c.flow.budgetRow, expense: c.flow.expenseRow,
  }
  const run = (id: SetupStepId) => {
    if (id === 'accounts') navigate('/accounts')
    else if (id === 'sms') navigate('/settings/sms')
    else if (id === 'payday') navigate('/paydays')
    else if (id === 'budget') navigate('/budget-setup')
    else setActiveModal('quickAdd')
  }
  const journeyOpen = !!record && !record.doneAt

  const ready = done.has('accounts') && done.has('payday') && payday !== undefined
  const rows = (list: typeof steps): ReactNode => (
    <Card padding="none" className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl">
      {list.map((s) => {
        const Icon = ICONS[s.id]
        return (
          <button
            key={s.id}
            type="button"
            data-raw-button-ok="a whole-row tap target, sized by its content"
            onClick={() => run(s.id)}
            className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2 text-start"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]"><Icon className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{rowCopy[s.id].title}</span>
              <span className="block text-[12.5px] text-[var(--color-brand-text-muted)]">{rowCopy[s.id].sub}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
          </button>
        )
      })}
    </Card>
  )

  if (ready) {
    const allowance = dailyAllowance(model.totalInBase, new Date(), payday)
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <Card className="flex flex-col gap-1 !bg-[var(--color-brand-primary)] !text-[var(--color-brand-on-primary)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-90">{c.flow.allSet(name)}</span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">{c.flow.daysToPayday(allowance.days)}</span>
          </div>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono-numbers text-4xl font-semibold leading-none tracking-[-0.03em]">{fmt(allowance.perDay ?? model.totalInBase)}</span>
            <span className="text-[13px] opacity-90">{allowance.perDay !== null ? c.flow.perDay(base) : base}</span>
          </p>
        </Card>
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <BuddgyHead mood="awake" size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{c.flow.firstTitle}</p>
              <p className="mt-0.5 text-[13px] text-[var(--color-brand-text-secondary)]">{c.flow.firstBody}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="cta" className="flex-[1.3]" onClick={() => setActiveModal('quickAdd')}><Plus aria-hidden />{c.flow.addExpense}</Button>
            {done.has('sms') ? null : <Button size="cta" variant="outline" className="flex-1" onClick={() => navigate('/settings/sms')}>{c.flow.bankTexts}</Button>}
          </div>
        </Card>
        {todo.length > 0 ? (
          <>
            <button
              type="button"
              data-raw-button-ok="a whole-row tap target, sized by its content"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3.5 text-start shadow-sm"
            >
              <span className="rounded-full bg-[var(--color-brand-primary-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-brand-primary-ink)]">{c.flow.finishLeft(doneCount, steps.length)}</span>
              <span className="flex-1 text-[14.5px] font-semibold text-[var(--color-brand-text-primary)]">{c.flow.finish}</span>
              <ChevronRight className={cn('size-4 text-[var(--color-brand-text-muted)] transition-transform', open && 'rotate-90')} aria-hidden />
            </button>
            {open ? rows(todo) : null}
          </>
        ) : null}
      </div>
    )
  }

  const next = todo[0]
  const rest = todo.slice(1)
  const stepNo = steps.findIndex((s) => s.id === next?.id) + 1
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <Card className="flex flex-col gap-3.5 p-[18px]">
        <div className="flex items-center gap-3">
          <BuddgyHead mood="awake" size={52} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.flow.resumeTitle}</h2>
            {name ? <p className="mt-0.5 text-[13px] text-[var(--color-brand-text-secondary)]">{c.flow.welcomeBack(name)}</p> : null}
          </div>
        </div>
        {next ? (
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-brand-primary-soft)] px-3.5 py-3">
            <span className="rounded-full bg-[var(--color-brand-card)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-brand-primary-ink)]">{c.flow.stepLabel(stepNo, steps.length)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{rowCopy[next.id].title}</p>
              <p className="text-xs text-[var(--color-brand-text-secondary)]">{MINUTES[next.id] === 1 ? c.flow.minute : c.flow.minutes(MINUTES[next.id])}</p>
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-green)]"><Check className="size-4" aria-hidden />{c.automate.done}</p>
        )}
        {next ? (
          <Button size="cta" className="w-full" onClick={() => (journeyOpen ? resume() : run(next.id))}>
            {c.flow.continueSetup}
          </Button>
        ) : null}
      </Card>
      {rest.length > 0 ? (
        <div>
          <span className="mb-2 block px-1 text-[13px] font-semibold text-[var(--color-brand-text-secondary)]">{c.flow.more}</span>
          {rows(rest)}
        </div>
      ) : null}
    </div>
  )
}
