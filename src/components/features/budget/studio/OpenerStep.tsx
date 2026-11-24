'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { Textarea } from '@/components/ui/textarea'
import { readSituation } from '@/lib/budget/budgetAiClient'
import { SITUATION_MAX_TEXT } from '@/lib/budget/situationAi'
import type { Currency } from '@/lib/store/types'
import { useBudgetStudioCopy } from '../useStudioCopy'
import { StudioHeading } from './StudioHeading'

/** Enough to say something real; a single word cannot prefill anything. */
const MIN_CHARS = 12
/** A model that never answers must not hold the opener. */
const READ_TIMEOUT_MS = 20_000
/** Characters-left counts announced to screen readers, smallest first. */
const LEFT_STEPS = [0, 50, 200] as const

export interface OpenerStepProps {
  base: Currency
  /** What Buddgy picked out of the text. Returns false when none of it could be used, so the step says so. */
  onDone: (found: Record<string, unknown>) => boolean
  /** Carry on to the questions without a description (offered only after a failure or an empty read). */
  onSkip: () => void
}

type Problem = 'failed' | 'quota' | 'empty' | null

/** Always-asked first step: describe your situation and every question it answers is skipped. */
export function OpenerStep({ base, onDone, onSkip }: OpenerStepProps) {
  const c = useBudgetStudioCopy().opener
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  const live = useRef<AbortController | null>(null)
  const gone = useRef(false)

  // Leaving the studio mid-read cancels it, and a late answer is ignored so it never writes into the draft.
  useEffect(() => {
    gone.current = false
    return () => {
      gone.current = true
      live.current?.abort()
    }
  }, [])

  const send = async () => {
    setBusy(true)
    setProblem(null)
    const controller = new AbortController()
    live.current = controller
    const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
    const out = await readSituation(text.trim(), base, controller.signal)
    clearTimeout(timer)
    if (gone.current) return
    if (!out.ok) {
      setProblem(out.reason === 'quota' ? 'quota' : 'failed')
      setBusy(false)
    } else if (!onDone(out.data)) {
      setProblem('empty')
      setBusy(false)
    }
  }

  const left = SITUATION_MAX_TEXT - text.length
  // Screen readers hear the count only when it crosses a step, not on every keystroke.
  const step = LEFT_STEPS.find((s) => left <= s)

  return (
    <div className="flex flex-col gap-5">
      <StudioHeading mood={busy ? 'thinking' : 'curious'} label={busy ? c.working : c.kicker} title={c.title} hint={c.hint} />
      <div className="flex flex-col gap-1.5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={c.placeholder}
          maxLength={SITUATION_MAX_TEXT}
          disabled={busy}
          className="min-h-36 text-[0.9375rem]"
          aria-label={c.title}
          aria-describedby={problem ? 'opener-problem' : undefined}
        />
        {left <= SITUATION_MAX_TEXT * 0.2 ? (
          <p className="text-end text-xs text-[var(--color-brand-text-muted)]" aria-hidden>
            {c.left(left)}
          </p>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {step !== undefined ? c.left(step) : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.examples.map((x) => (
          <OptionChip key={x} as="trigger" size="md" disabled={busy} onClick={() => setText(x)}>
            <Sparkles aria-hidden />
            {x}
          </OptionChip>
        ))}
      </div>
      {problem ? (
        <p id="opener-problem" role="alert" className="rounded-2xl bg-[var(--color-brand-amber-soft)] px-4 py-3 text-sm text-[var(--color-brand-text-primary)]">
          {c[problem]}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button size="cta" className="w-full" loading={busy} disabled={text.trim().length < MIN_CHARS} onClick={() => void send()}>
          {problem === 'failed' ? c.retry : c.cta}
        </Button>
        {problem ? (
          <Button size="touch" variant="ghost" className="w-full" disabled={busy} onClick={onSkip}>
            {c.skip}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
