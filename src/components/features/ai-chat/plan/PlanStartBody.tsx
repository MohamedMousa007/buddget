'use client'

import { ChevronRight, LayoutList, MessageSquare, type LucideIcon } from 'lucide-react'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useBuddgyPlanCopy } from '@/lib/i18n/buddgyPlanCopy'
import { cn } from '@/lib/utils'

function Choice({ icon: Icon, title, sub, onClick, lead }: { icon: LucideIcon; title: string; sub: string; onClick: () => void; lead?: boolean }) {
  return (
    <SelectableCard as="action" layout="row" surface="card" selected={lead} onClick={onClick} className="min-h-16">
      <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', lead ? 'bg-[var(--color-brand-card)] text-[var(--color-brand-primary-ink)]' : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-primary-ink)]')}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
        <span dir="auto" className="block text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{sub}</span>
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-[var(--color-brand-text-secondary)] rtl:rotate-180" />
    </SelectableCard>
  )
}

/** A budget request in the chat: build it here, question by question, or open the full builder (plan 2.1). */
export function PlanStartBody({ onBuildHere, onOpenBuilder }: { onBuildHere: () => void; onOpenBuilder: () => void }) {
  const copy = useBuddgyPlanCopy().start
  return (
    <div className="flex flex-col gap-2">
      <Choice lead icon={MessageSquare} title={copy.here} sub={copy.hereSub} onClick={onBuildHere} />
      <Choice icon={LayoutList} title={copy.builder} sub={copy.builderSub} onClick={onOpenBuilder} />
      <p dir="auto" className="px-1 text-xs text-[var(--color-brand-text-muted)]">{copy.cost}</p>
    </div>
  )
}
