'use client'

import { AlertCircle, RotateCw, Zap } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { BuddgyMarkdown } from '@/components/features/ai-chat/BuddgyMarkdown'
import { ProposalCard } from '@/components/features/ai-chat/ProposalCard'
import { Button } from '@/components/ui/button'
import type { BuddgyItem, ChatItem } from '@/lib/buddgy/client/chatTypes'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'

export interface AIChatMessageListProps {
  items: ChatItem[]
  /** Read tool currently running, shown on the reply being written. */
  step: string | null
  onApply: (itemId: string, proposalId: string) => void
  onDismiss: (itemId: string, proposalId: string) => void
  onRevise: (itemId: string, proposalId: string, patch: Record<string, string>) => void
  onUndo: (itemId: string, proposalId: string) => void
  onRetry: () => void
  onContinue: () => void
}

function Dots() {
  return (
    <div className="flex gap-1 py-1" aria-hidden>
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="size-2 animate-bounce rounded-full bg-[var(--color-brand-text-muted)] motion-reduce:animate-none"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </div>
  )
}

function moodFor(item: BuddgyItem) {
  if (item.status === 'error') return 'worried' as const
  if (item.status === 'streaming') return 'talking' as const
  return item.proposals.some((p) => p.status === 'applied') ? ('done' as const) : ('awake' as const)
}

/** The transcript. A live log region so screen readers hear each reply as it lands. */
export function AIChatMessageList({ items, step, onApply, onDismiss, onRevise, onUndo, onRetry, onContinue }: AIChatMessageListProps) {
  const copy = useBuddgyChatCopy()
  return (
    <div role="log" aria-live="polite" aria-relevant="additions text" className="space-y-4">
      {items.map((item, i) => {
        if (item.role === 'user') {
          return (
            <div key={item.id} className="flex justify-end">
              <p dir="auto" className="max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-ee-md bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm text-[var(--color-brand-on-primary)]">
                {item.text}
              </p>
            </div>
          )
        }
        const last = i === items.length - 1
        const waiting = item.status === 'streaming' && item.text === ''
        return (
          <div key={item.id} className="flex items-end gap-2">
            <span className="mb-0.5 shrink-0 self-start text-[var(--color-brand-text)]">
              <BuddgyIcon mood={moodFor(item)} size={26} strokeWidth={1.75} filled animated={last} />
            </span>
            <div className="flex min-w-0 max-w-[92%] flex-1 flex-col items-start gap-2">
              {item.text !== '' || waiting ? (
                <div className="max-w-full rounded-2xl rounded-es-md bg-[var(--color-brand-elevated)] px-4 py-2.5 text-sm text-[var(--color-brand-text-primary)]">
                  {waiting ? (
                    step ? <p className="text-[var(--color-brand-text-muted)]">{copy.checking(step)}</p> : <Dots />
                  ) : (
                    <BuddgyMarkdown text={item.text} />
                  )}
                </div>
              ) : null}

              {item.proposals.map((p) => (
                <div key={p.proposal.id} className="w-full">
                  <ProposalCard
                    state={p}
                    onApply={() => onApply(item.id, p.proposal.id)}
                    onDismiss={() => onDismiss(item.id, p.proposal.id)}
                    onRevise={(patch) => onRevise(item.id, p.proposal.id, patch)}
                    onUndo={() => onUndo(item.id, p.proposal.id)}
                  />
                </div>
              ))}

              {item.status === 'error' && item.error ? (
                <div className="flex w-full items-start gap-2 rounded-xl border border-[var(--color-brand-border)] px-3 py-2.5 text-[13px] text-[var(--color-brand-text-secondary)]">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-brand-amber)]" aria-hidden />
                  <span className="min-w-0 flex-1">{copy.error(item.error)}</span>
                  {last && item.error.kind !== 'quota' ? (
                    <Button variant="ghost" size="touch" onClick={onRetry} className="-my-1.5 shrink-0 px-3 text-[13px]">
                      <RotateCw aria-hidden />
                      {copy.retry}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {item.status === 'done' && item.truncated && last ? (
                <Button variant="outline" size="touch" onClick={onContinue} className="text-[13px]">
                  {copy.keepGoing}
                </Button>
              ) : null}

              {item.status === 'done' && (item.reads.length > 0 || item.local) ? (
                <p className="flex items-center gap-1 px-1 text-[11px] text-[var(--color-brand-text-muted)]">
                  {item.local ? <Zap className="size-3" aria-hidden /> : null}
                  {item.local ? copy.localTag : `${copy.checked}: ${[...new Set(item.reads.map((r) => r.label))].join(' · ')}`}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
