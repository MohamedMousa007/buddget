'use client'

import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'

/**
 * Step 0: Free-text input — the only typing step.
 * User describes their situation; AI parses it once.
 */
export function BuddgyStepDescribe({ flow }: { flow: BuddgyBuilderApi }) {
  const [text, setText] = useState('')

  const canSubmit = text.trim().length > 10 && !flow.loading

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-brand-text-primary)]">
        Tell me about your situation.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I'm a couple in Dubai, earning 15k AED, rent is 4000..."
        rows={4}
        className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)]/40 resize-none"
        disabled={flow.loading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
            e.preventDefault()
            flow.submitDescription(text.trim())
          }
        }}
      />

      {flow.error && (
        <p className="text-xs text-[var(--color-brand-red)]">{flow.error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => flow.submitDescription(text.trim())}
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {flow.loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
