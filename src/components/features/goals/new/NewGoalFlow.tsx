'use client'

import { useState } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { SplitSavingsSheet } from '@/components/features/goals/SplitSavingsSheet'
import { ModalShell } from '@/components/modals/ModalShell'
import { GoalChat } from '@/components/features/goals/new/GoalChat'
import { StepDescribe } from '@/components/features/goals/new/StepDescribe'
import { StepFundIt, useFundCopy } from '@/components/features/goals/new/StepFundIt'
import { StepMakeItReal } from '@/components/features/goals/new/StepMakeItReal'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { useNewGoalForm, type FlowSeed } from '@/hooks/useNewGoalForm'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { formatCurrency } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils'

function Flow({ seed, onClose }: { seed: FlowSeed | null; onClose: () => void }) {
  const t = useT().goals.flow
  const { locale } = useLocale()
  const form = useNewGoalForm(seed, onClose)
  const fund = useFundCopy(form)
  const [split, setSplit] = useState(false)
  // Free text from the empty state or step 1 opens a conversation with Buddgy instead of filling fields silently.
  const [chat, setChat] = useState<string | null>(seed?.text ?? null)
  const total = form.kind === 'save' ? 3 : 2
  const step = Math.min(form.step, total) as 1 | 2 | 3
  const last = step === total
  const quarterly = form.frequency === 'quarterly'
  const finish = formatLocalized(new Date(`${form.targetDate.slice(0, 7)}-01T00:00:00`), 'd MMM yyyy', locale)

  const summary =
    step === 2 && form.kind === 'save' && form.pace.asked > 0
      ? t.s2.summary(formatCurrency(Math.round(form.pace.asked), form.currency, false), quarterly, finish)
      : step === 3
        ? fund.summary
        : null

  const next = () => (last ? form.submit() : form.setStep((step + 1) as 2 | 3))
  const nextLabel = last ? t.start : form.kind === 'save' ? t.nextFund : t.next

  if (chat !== null) {
    const leave = () => {
      setChat(null)
      form.setStep(2)
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-12 shrink-0 items-center gap-2 ps-3 pe-3">
          <IconButton aria-label={t.back} onClick={() => setChat(null)}>
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
          <p className="flex-1 text-center text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{t.chat.title}</p>
          <IconButton aria-label={t.close} onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <GoalChat key={chat} form={form} firstText={chat || null} onContinue={leave} onManual={leave} />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-12 shrink-0 items-center gap-2 ps-3 pe-3">
        {step > 1 ? (
          <IconButton aria-label={t.back} onClick={() => form.setStep((step - 1) as 1 | 2)}>
            <ChevronLeft className="rtl:rotate-180" />
          </IconButton>
        ) : null}
        <div className="flex flex-1 justify-center gap-1" role="img" aria-label={t.stepAria(step, total)}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn('h-1 w-7 rounded-full', i < step ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border)]')}
            />
          ))}
        </div>
        <IconButton aria-label={t.close} onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="native-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 pt-1 md:px-6 [&>*]:shrink-0">
        {step === 1 ? (
          <StepDescribe onDescribe={setChat} onPick={form.pickCategory} />
        ) : step === 2 ? (
          <StepMakeItReal form={form} />
        ) : (
          <StepFundIt form={form} onOpenSplit={() => setSplit(true)} />
        )}
      </div>
      {step > 1 ? (
        <div className="sheet-cta flex shrink-0 flex-col gap-2.5 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 pb-6 pt-3 md:px-6">
          {form.saveError ? <p role="alert" className="text-xs text-[var(--color-brand-red-text)]">{t.saveError}</p> : null}
          {summary ? <p className="font-mono-numbers text-[13px] text-[var(--color-brand-text-secondary)]">{summary}</p> : null}
          <Button size="cta-block" disabled={step === 2 && !form.canNext2} onClick={next}>
            {nextLabel}
          </Button>
        </div>
      ) : null}
      {split ? <SplitSavingsSheet onClose={() => setSplit(false)} /> : null}
    </div>
  )
}

/** Create-goal flow: describe or pick, make it real (date first), fund it. A draft survives closing. */
export function NewGoalFlow({ open, seed, onClose }: { open: boolean; seed: FlowSeed | null; onClose: () => void }) {
  const t = useT()
  if (!open) return null
  return (
    <ModalShell
      open={open}
      ariaLabel={t.goals.addGoal}
      onBackdropClick={onClose}
      scrollChild
      panelClassName="h-[calc(100dvh-40px)] max-h-[calc(100dvh-40px)] md:h-[min(46rem,calc(100dvh-4rem))] md:max-h-[calc(100dvh-4rem)] md:w-[min(28rem,calc(100vw-2rem))] md:rounded-3xl"
    >
      <Flow seed={seed} onClose={onClose} />
    </ModalShell>
  )
}
