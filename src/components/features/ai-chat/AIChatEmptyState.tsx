'use client'

import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Landmark, PiggyBank, SlidersHorizontal, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useBuddgyIdeaContext } from '@/hooks/useBuddgyIdeaContext'
import { buddgyIdeas, type BuddgyIdea } from '@/lib/ai/buddgyIdeas'

export interface AIChatEmptyStateProps {
  /** Sends the prompt immediately — a chip starts the conversation. */
  onPickSuggestion: (prompt: string) => void
}

const KIND_ICON: Record<BuddgyIdea['kind'], LucideIcon> = {
  fix: AlertTriangle,
  plan: SlidersHorizontal,
  insight: Sparkles,
  debt: Landmark,
  save: PiggyBank,
}

/**
 * First screen of a conversation: Buddgy says hello and offers the four
 * questions most worth asking right now — a live problem first, then what fits
 * the screen the chat was opened from.
 */
export function AIChatEmptyState({ onPickSuggestion }: AIChatEmptyStateProps) {
  const t = useT()
  const name = useFinanceStore((s) => s.profile.name?.split(' ')[0] ?? '')
  const ideas = buddgyIdeas(useBuddgyIdeaContext(), t.buddgy)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? t.buddgy.greetingMorning : hour < 18 ? t.buddgy.greetingAfternoon : t.buddgy.greetingEvening

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 pt-2 text-center text-[var(--color-brand-text)]">
        <BuddgyIcon mood="wink" size={64} strokeWidth={1.5} filled alive />
        <p className="text-base font-bold text-[var(--color-brand-text-primary)]">{greeting(name)}</p>
        <p className="max-w-64 text-sm text-[var(--color-brand-text-muted)]">{t.buddgy.greetingSub}</p>
      </div>
      <div className="flex flex-col gap-2">
        {ideas.map(({ id, prompt, kind }) => {
          const Icon = KIND_ICON[kind]
          return (
            <SelectableCard
              key={id}
              as="action"
              onClick={() => onPickSuggestion(prompt)}
              className="gap-3 rounded-lg px-3.5 py-3"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  kind === 'fix'
                    ? 'bg-[var(--color-brand-amber-soft)] text-[var(--color-brand-amber)]'
                    : 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-start text-[var(--color-brand-text-primary)]">{prompt}</span>
            </SelectableCard>
          )
        })}
      </div>
    </div>
  )
}
