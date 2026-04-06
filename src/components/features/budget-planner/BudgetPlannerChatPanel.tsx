'use client'

import type { RefObject } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BudgetPlannerChatMessage } from '@/hooks/useBudgetPlannerChat'
import type { BudgetPlan } from '@/lib/store/types'
import type { AIActionItem } from '@/lib/ai/gemini'
import { AIChatTypingIndicator } from '@/components/features/ai-chat/AIChatTypingIndicator'

export interface BudgetPlannerChatPanelProps {
  plan: BudgetPlan | null
  messages: BudgetPlannerChatMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  loading: boolean
  onApply: (messageId: string) => void
  scrollAnchorRef: RefObject<HTMLDivElement | null>
  builderActive?: boolean
  labels: {
    title: string
    subtitle: string
    builderBadge: string
    placeholder: string
    send: string
    apply: string
    applied: string
  }
}

function countApplyable(actions: AIActionItem[] | undefined, planId: string): number {
  if (!actions) return 0
  return actions.filter((a) => {
    const pid = String(a.data.planId ?? a.data.plan_id ?? '')
    if (pid !== planId) return false
    return a.action === 'update_budget_plan_row' || a.action === 'replace_budget_plan'
  }).length
}

/** Buddgy chat with Apply for plan row updates or full plan replace. */
export function BudgetPlannerChatPanel({
  plan,
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  onApply,
  scrollAnchorRef,
  builderActive = false,
  labels,
}: BudgetPlannerChatPanelProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[#111118] flex flex-col min-h-[320px] max-h-[480px] font-sans">
      <div className="flex flex-col gap-0.5 px-5 pt-4 pb-2 border-b border-[var(--color-brand-border)]/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[var(--color-brand-red)] shrink-0" />
          <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
            {labels.title}
          </h2>
        </div>
        <p className="text-xs text-[var(--color-brand-text-muted)] ps-6">{labels.subtitle}</p>
        {builderActive ? (
          <p className="text-[11px] text-[var(--color-brand-amber)] ps-6 font-medium">{labels.builderBadge}</p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {!plan ? (
          <p className="text-xs text-[var(--color-brand-text-muted)]">Select a plan to chat.</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-[var(--color-brand-text-muted)]">{labels.placeholder}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[90%] rounded-2xl px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'bg-[var(--color-brand-red)] text-white'
                    : 'bg-[var(--color-brand-elevated)] text-white'
                )}
              >
                <p className="whitespace-pre-line font-sans">{m.content}</p>
                {m.role === 'assistant' && plan && m.aiResponse ? (
                  (() => {
                    const n = countApplyable(m.aiResponse.actions, plan.id)
                    if (n === 0) return null
                    return (
                      <div className="mt-2 pt-2 border-t border-[var(--color-brand-border)]/50">
                        {m.suggestionApplied ? (
                          <span className="text-xs text-[var(--color-brand-green)]">{labels.applied}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onApply(m.id)}
                            className="text-xs font-medium text-[var(--color-brand-red)] hover:underline"
                          >
                            {labels.apply}
                          </button>
                        )}
                      </div>
                    )
                  })()
                ) : null}
              </div>
            </div>
          ))
        )}
        {loading ? (
          <div className="flex justify-start ps-1">
            <AIChatTypingIndicator />
          </div>
        ) : null}
        <div ref={scrollAnchorRef} />
      </div>
      <div className="p-3 border-t border-[var(--color-brand-border)]/60 flex gap-2">
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder={labels.placeholder}
          disabled={!plan || loading}
          className="flex-1 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 py-2 text-sm text-white placeholder:text-[var(--color-brand-text-muted)] outline-none focus:border-[var(--color-brand-red)]"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!plan || loading || !input.trim()}
          className="shrink-0 rounded-xl bg-[var(--color-brand-red)] px-3 py-2 text-white disabled:opacity-40"
          aria-label={labels.send}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
