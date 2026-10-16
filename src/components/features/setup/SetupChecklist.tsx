'use client'

import { Check, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { navigate } from '@/lib/navigation/navigate'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useSetupProgress, type SetupStepId } from '@/hooks/useSetupProgress'

/** The setup checklist: one card on Flow for a brand-new user, the same card in the header chip's sheet. */
export function SetupChecklist({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const t = useT()
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const { steps, doneCount, pct } = useSetupProgress()

  const copy: Record<SetupStepId, { title: string; body: string }> = {
    sms: { title: t.setup.smsTitle, body: t.setup.smsBody },
    payday: { title: t.setup.paydayTitle, body: t.setup.paydayBody },
    budget: { title: t.setup.budgetTitle, body: t.setup.budgetBody },
    expense: { title: t.setup.expenseTitle, body: t.setup.expenseBody },
  }
  const run = (id: SetupStepId) => {
    onNavigate?.()
    if (id === 'sms') navigate('/settings/sms')
    else if (id === 'payday') navigate('/paydays')
    else if (id === 'budget') navigate('/budget-setup')
    else setActiveModal('quickAdd')
  }
  const focusId = steps.find((s) => !s.done)?.id

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--color-brand-text-primary)]">{t.setup.title}</h2>
        <span className="font-mono-numbers text-[13px] text-[var(--color-brand-text-secondary)]">
          {t.setup.progress(doneCount, steps.length)}
        </span>
      </div>
      <Progress value={pct} aria-label={t.setup.title} />
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const focus = step.id === focusId
          const { title, body } = copy[step.id]
          return (
            <SelectableCard
              key={step.id}
              as="action"
              selected={focus}
              onClick={() => run(step.id)}
              className={cn(!step.done && !focus && 'opacity-80')}
            >
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  step.done
                    ? 'bg-[var(--color-brand-green)] text-[var(--color-brand-on-primary)]'
                    : focus
                      ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
                      : 'bg-[var(--color-brand-sunken)] text-[var(--color-brand-text-muted)]',
                )}
              >
                {step.done ? <Check className="size-4" aria-hidden /> : <span className="font-mono-numbers">{i + 1}</span>}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cn(
                    'text-sm font-medium',
                    step.done
                      ? 'text-[var(--color-brand-text-secondary)] line-through'
                      : 'text-[var(--color-brand-text-primary)]',
                  )}
                >
                  {title}
                </span>
                {step.done ? null : (
                  <span className="text-xs text-[var(--color-brand-text-secondary)]">{body}</span>
                )}
              </span>
              {focus ? <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-primary-ink)] rtl:rotate-180" aria-hidden /> : null}
            </SelectableCard>
          )
        })}
      </div>
    </Card>
  )
}
