'use client'

import { useMemo, useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { defaultFor, screenNodes } from '@/lib/budget/flow/flow'
import type { FlowNode, FlowState, FlowValue } from '@/lib/budget/flow/types'
import type { Currency } from '@/lib/store/types'
import { useBudgetStudioCopy } from '../useStudioCopy'
import { QuestionControl } from './QuestionControl'
import { StudioHeading } from './StudioHeading'

export type ScreenAnswer = { id: string; value: FlowValue } | { id: string; skip: true }

export interface ScreenStepProps {
  state: FlowState
  head: FlowNode
  /** The person is changing an earlier answer rather than answering for the first time. */
  reopen: boolean
  base: Currency
  saved: boolean
  /** Fills `{income}` and `{n}` in a question. */
  fill: (id: string) => string
  onSubmit: (answers: ScreenAnswer[]) => void
}

const isValid = (x: FlowNode, v: FlowValue | undefined): boolean =>
  x.control === 'amount' ? typeof v === 'number' && v >= (x.id === 'income' ? 1 : 0)
    : x.control === 'chips' || x.control === 'toggle' ? v !== undefined
      // Owing money with no kind chosen leaves nothing to ask about.
      : x.id === 'debtKinds' ? Array.isArray(v) && v.length > 0
        : true

/** One card of the budget builder: the question, and the few related fields its answers unlock, on a single screen. */
export function ScreenStep({ state, head, reopen, base, saved, fill, onSubmit }: ScreenStepProps) {
  const ui = useBudgetStudioCopy()
  const [values, setValues] = useState<Record<string, FlowValue>>(() =>
    reopen ? Object.fromEntries(Object.entries(state.a).filter(([k]) => state.a[k] !== undefined)) : {},
  )
  const [skips, setSkips] = useState<string[]>([])
  const nodes = useMemo(() => screenNodes(state, head, values, skips, reopen), [state, head, values, skips, reopen])
  const valueOf = (x: FlowNode) => values[x.id] ?? defaultFor(x, state)
  const ready = nodes.every((x) => skips.includes(x.id) || isValid(x, valueOf(x)))
  const found = head.control === 'confirm'
  const first = nodes[0]
  const copyOf = (x: FlowNode) => ui.q[x.id] ?? { label: x.id, why: '' }
  const textOf = (x: FlowNode) => {
    const c = copyOf(x)
    const count = Number(fill(x.id))
    const plural = count === 1 ? 'one' : count === 2 ? 'two' : ''
    return (c.variants?.[x.variant?.(state) ?? ''] ?? (x.control === 'confirm' ? c.variants?.[plural] : undefined) ?? c.label).replace('{income}', fill(x.id)).replace('{n}', fill(x.id))
  }

  const submit = () =>
    onSubmit(nodes.map((x): ScreenAnswer => (skips.includes(x.id) ? { id: x.id, skip: true } : { id: x.id, value: valueOf(x) as FlowValue })))

  return (
    <div className="flex flex-col gap-5">
      <StudioHeading
        mood="curious"
        label={ui.buddgyAsks}
        title={found ? ui.found.title : first ? textOf(first) : ''}
        hint={found ? ui.found.sub : first ? `${ui.why}: ${copyOf(first).why}` : undefined}
      />

      {found ? (
        <div className="flex flex-col gap-3">
          {nodes.map((x) => (
            <Card key={x.id} padding="md" className="flex flex-col gap-2.5">
              <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{textOf(x)}</p>
              <SegmentedControl
                ariaLabel={textOf(x)}
                value={valueOf(x) === false ? 'change' : 'right'}
                onChange={(v) => setValues((prev) => ({ ...prev, [x.id]: v === 'right' }))}
                options={[
                  { value: 'right', label: ui.found.right },
                  { value: 'change', label: ui.found.change },
                ]}
              />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {nodes.map((x, i) => (
            <div key={x.id} className="flex flex-col gap-3">
              {i > 0 ? <p className="text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{textOf(x)}</p> : null}
              {skips.includes(x.id) ? null : (
                <QuestionControl
                  node={x}
                  copy={copyOf(x)}
                  ui={ui}
                  base={base}
                  value={valueOf(x)}
                  onChange={(v) => setValues((prev) => (v === undefined ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== x.id)) : { ...prev, [x.id]: v }))}
                />
              )}
              {x.skippable ? (
                <OptionChip
                  size="md"
                  className="self-start"
                  selected={skips.includes(x.id)}
                  onClick={() => setSkips((s) => (s.includes(x.id) ? s.filter((k) => k !== x.id) : [...s, x.id]))}
                >
                  <Sparkles aria-hidden />
                  {ui.estimate}
                </OptionChip>
              ) : null}
            </div>
          ))}
        </>
      )}

      {saved ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-brand-green)]">
          <Check className="size-3.5" aria-hidden />
          {ui.saved}
        </p>
      ) : null}

      <Button size="cta" className="w-full" disabled={!ready} onClick={submit}>
        {ui.cont}
      </Button>
    </div>
  )
}
