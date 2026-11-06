'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { Textarea } from '@/components/ui/textarea'
import { readSituation } from '@/lib/budget/budgetAiClient'
import type { Currency } from '@/lib/store/types'
import { useBudgetStudioCopy } from '../useStudioCopy'
import { StudioHeading } from './StudioHeading'

/** Enough to say something real; a single word cannot prefill anything. */
const MIN_CHARS = 12

export interface OpenerStepProps {
  base: Currency
  /** What Buddgy picked out of the text (empty when nothing, or when the call failed). */
  onDone: (found: Record<string, unknown>) => void
}

/** Always-asked first step: describe your situation and every question it answers is skipped. */
export function OpenerStep({ base, onDone }: OpenerStepProps) {
  const c = useBudgetStudioCopy().opener
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    const out = await readSituation(text.trim(), base)
    onDone(out.ok ? out.data : {})
  }

  return (
    <div className="flex flex-col gap-5">
      <StudioHeading mood={busy ? 'thinking' : 'curious'} label={busy ? c.working : c.kicker} title={c.title} hint={c.hint} />
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={c.placeholder}
        maxLength={400}
        disabled={busy}
        className="min-h-36 text-[0.9375rem]"
        aria-label={c.title}
      />
      <div className="flex flex-wrap gap-2">
        {c.examples.map((x) => (
          <OptionChip key={x} as="trigger" size="md" disabled={busy} onClick={() => setText(x)}>
            <Sparkles aria-hidden />
            {x}
          </OptionChip>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Button size="cta" className="w-full" loading={busy} disabled={text.trim().length < MIN_CHARS} onClick={() => void send()}>
          {c.cta}
        </Button>
      </div>
    </div>
  )
}
