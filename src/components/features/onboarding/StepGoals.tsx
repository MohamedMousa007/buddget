'use client'

import { useState } from 'react'
import { Check, CalendarClock, Coins, Eye, Info, Landmark, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { prioritiesFor, toggleGoal } from '@/lib/onboarding/steps'
import type { OnboardingGoal } from '@/lib/store/types'
import { cn } from '@/lib/utils'
import { BuddgyHead, stepLead, stepTitle } from './BuddgyHead'
import type { StepChrome } from './chrome'
import { JourneyFrame } from './JourneyFrame'
import { useOnboarding } from './useOnboarding'
import { useOnboardingCopy } from './useOnboardingCopy'

const GOALS: Array<{ id: OnboardingGoal; Icon: typeof Eye }> = [
  { id: 'see', Icon: Eye },
  { id: 'runout', Icon: CalendarClock },
  { id: 'save', Icon: Coins },
  { id: 'debt', Icon: Landmark },
  { id: 'budget', Icon: SlidersHorizontal },
]

/** Step 2: what brings you here. Up to two; they seed the first budget's priorities. */
export function StepGoals({ chrome }: { chrome: StepChrome }) {
  const c = useOnboardingCopy()
  const name = useFinanceStore((s) => s.profile.name)
  const { record, setGoals } = useOnboarding()
  const [goals, setLocal] = useState<OnboardingGoal[]>(record?.goals ?? [])

  const save = () => {
    setGoals(goals)
    const { profile, updateProfile } = useFinanceStore.getState()
    updateProfile({ financialProfile: { ...profile.financialProfile, priorities: prioritiesFor(goals) } })
    chrome.next()
  }

  return (
    <JourneyFrame
      {...chrome}
      footer={
        <Button size="cta" className="w-full" onClick={save}>
          {c.cont}
        </Button>
      }
    >
      <BuddgyHead mood="curious" />
      <h1 className={`${stepTitle} mt-[18px]`}>{c.goals.title(name)}</h1>
      <p className={stepLead}>{c.goals.lead}</p>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {GOALS.map(({ id, Icon }, i) => {
          const on = goals.includes(id)
          return (
            <SelectableCard
              key={id}
              as="action"
              layout="stack"
              selected={on}
              onClick={() => setLocal((g) => toggleGoal(g, id))}
              aria-pressed={on}
              className={cn('min-h-[112px]', i === GOALS.length - 1 && 'col-span-2 min-h-[76px] flex-row items-center')}
            >
              <span className={cn('flex size-[38px] items-center justify-center rounded-xl', on ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]' : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]')}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-start text-[0.90625rem] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{c.goals.options[id]}</span>
              {on ? (
                <span className="absolute end-2.5 top-2.5 flex size-[22px] items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
              ) : null}
            </SelectableCard>
          )
        })}
      </div>

      <p className="mt-3.5 flex items-start gap-2 text-[0.78125rem] leading-snug text-[var(--color-brand-text-muted)]">
        <Info className="mt-px size-4 shrink-0" aria-hidden />
        {c.goals.why}
      </p>
    </JourneyFrame>
  )
}
