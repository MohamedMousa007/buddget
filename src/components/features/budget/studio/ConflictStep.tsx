'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import type { ConflictChoice } from '@/lib/budget/flow/types'
import { useBudgetStudioCopy } from '../useStudioCopy'
import { StudioHeading } from './StudioHeading'

/** Long enough to see the tick land, short enough to feel instant. */
const SETTLE_MS = 220

export interface ConflictOption {
  /** The value as the person reads it ("EGP 20,000", "Rent", "I owe nothing"). */
  value: string
  /** Where it comes from ("In Buddget", "What you just wrote"). */
  source: string
}

export interface ConflictStepProps {
  index: number
  total: number
  title: string
  app: ConflictOption
  typed: ConflictOption
  onPick: (choice: ConflictChoice) => void
  /** Keeps the app's value; the explicit way past a conflict, never a silent default. */
  onKeep: () => void
  /** Back to the previous conflict; absent on the first. */
  onBack?: () => void
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** One disagreement between the description and the app's data, answered with one tap on the value to plan with. */
export function ConflictStep({ index, total, title, app, typed, onPick, onKeep, onBack }: ConflictStepProps) {
  const c = useBudgetStudioCopy().conflict
  const titleId = useId()
  const head = useRef<HTMLDivElement>(null)
  const [picked, setPicked] = useState<ConflictChoice | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Each conflict is a new question: move focus to it so a screen reader reads it.
  useEffect(() => {
    head.current?.focus()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const pick = (choice: ConflictChoice) => {
    if (picked) return
    setPicked(choice)
    if (prefersReducedMotion()) onPick(choice)
    else timer.current = setTimeout(() => onPick(choice), SETTLE_MS)
  }

  // Arrow keys move between the two values (either direction, so it reads the same in RTL); Enter or Space picks one.
  const moveFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
    const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')]
    const other = radios.find((r) => r !== document.activeElement)
    if (!other) return
    e.preventDefault()
    other.focus()
  }

  const option = (choice: ConflictChoice, o: ConflictOption) => (
    <SelectableCard
      surface="card"
      selected={picked === choice}
      disabled={picked !== null && picked !== choice}
      onClick={() => pick(choice)}
      className="min-h-16 gap-3"
    >
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <Badge tone={choice === 'typed' ? 'brand' : 'soft'} size="default">{o.source}</Badge>
        <span className="font-mono-numbers text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)] [unicode-bidi:plaintext]">{o.value}</span>
      </span>
      <span
        aria-hidden
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${picked === choice ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]' : 'border-[var(--color-brand-border)]'}`}
      >
        {picked === choice ? <Check className="size-4" /> : null}
      </span>
    </SelectableCard>
  )

  return (
    <div className="flex flex-col gap-5">
      <div ref={head} tabIndex={-1} id={titleId} className="flex flex-col gap-3 outline-none" aria-live="polite">
        <StudioHeading mood="thinking" label={c.counter(index + 1, total)} title={title} hint={c.hint} />
      </div>
      <div role="radiogroup" aria-labelledby={titleId} className="flex flex-col gap-3" onKeyDown={moveFocus}>
        {option('app', app)}
        {option('typed', typed)}
      </div>
      <div className="flex flex-col gap-2">
        <Button size="touch" variant="ghost" className="w-full" disabled={picked !== null} onClick={onKeep}>
          {c.keep}
        </Button>
        {onBack ? (
          <Button size="touch" variant="ghost" className="w-full" disabled={picked !== null} onClick={onBack}>
            <ChevronLeft className="rtl:rotate-180" aria-hidden />
            {c.back}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
