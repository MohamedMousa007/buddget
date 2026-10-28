'use client'

import { useState } from 'react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { Textarea } from '@/components/ui/textarea'
import { readSituation } from '@/lib/budget/budgetAiClient'
import type { Currency } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useBudgetStudioCopy } from '../useStudioCopy'

export interface OpenerStepProps {
  base: Currency
  /** What Buddgy picked out of the text (empty when nothing, or when the call failed). */
  onDone: (found: Record<string, unknown>) => void
  onSkip: () => void
}

/** Optional first step: describe your situation in a sentence or two and the questions it answers are skipped. */
export function OpenerStep({ base, onDone, onSkip }: OpenerStepProps) {
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
      <div className="flex items-end gap-3">
        <BuddgyIcon mood={busy ? 'thinking' : 'curious'} size={44} />
        <p className={`${microClassName} pb-1`}>{busy ? c.working : c.kicker}</p>
      </div>
      <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.title}</h1>
      <p className="text-[13.5px] text-[var(--color-brand-text-secondary)]">{c.hint}</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={c.placeholder}
        maxLength={400}
        disabled={busy}
        className="min-h-28 text-[15px]"
        aria-label={c.title}
      />
      <div className="flex flex-wrap gap-2">
        {c.examples.map((x) => (
          <OptionChip key={x} as="trigger" size="md" disabled={busy} onClick={() => setText(x)}>
            {x}
          </OptionChip>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Button size="cta" className="w-full" loading={busy} disabled={!text.trim()} onClick={() => void send()}>
          {c.cta}
        </Button>
        <Button size="touch" variant="ghost" className="w-full" disabled={busy} onClick={onSkip}>
          {c.skip}
        </Button>
      </div>
    </div>
  )
}
