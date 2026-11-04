'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, Coins, Copy, FilePlus, Hammer, LayoutTemplate, Landmark, Target, X, type LucideIcon } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { PageBody } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { buildFactsFromStore } from '@/lib/budget/factsFromStore'
import { CREATE_INTENTS, type CreateIntent } from '@/lib/budget/templates'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { BudgetPlan } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { TintedTile } from '../TintedTile'
import { useBudgetBuilderCopy } from '../useBuilderCopy'

const INTENT_UI: Record<CreateIntent, { icon: LucideIcon; cat: 1 | 2 | 3 }> = {
  save: { icon: Coins, cat: 1 },
  goal: { icon: Target, cat: 2 },
  debt: { icon: Landmark, cat: 3 },
}

export interface CreateChooserProps {
  plans: BudgetPlan[]
  drafts: BudgetPlan[]
  onIntent: (intent: CreateIntent) => void
  onBlank: () => void
  onTemplate: () => void
  onCopy: (planId: string) => void
  onContinue: (planId: string) => void
  /** Absent when this is the main screen (no budget yet), so there is nothing to close. */
  onClose?: () => void
}

/** Intent-first entry to making a budget; the build-it-yourself paths sit below. */
export function CreateChooser(p: CreateChooserProps) {
  const copy = useBudgetBuilderCopy()
  const c = copy.create
  const closeLabel = copy.close
  const [copying, setCopying] = useState(false)
  // Months of spending the app already holds; with some, every starting point asks less.
  const dataMonths = useMemo(() => buildFactsFromStore(useFinanceStore.getState(), new Date()).averageCycles ?? 0, [])
  return (
    <PageBody className="space-y-4 lg:pb-6">
      <div className="flex items-center gap-2">
        {copying || p.onClose ? (
          <IconButton variant="outlined" aria-label={closeLabel} onClick={copying ? () => setCopying(false) : p.onClose}>
            {copying ? <ChevronLeft className="rtl:rotate-180" /> : <X />}
          </IconButton>
        ) : null}
        <span className="flex-1" />
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--color-brand-elevated)] px-3 text-xs font-semibold text-[var(--color-brand-text-secondary)]">
          <Clock className="size-3" aria-hidden />
          {c.about}
        </span>
      </div>

      {copying ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{c.copyTitle}</h2>
          {p.plans.map((pl) => (
            <Button key={pl.id} variant="outline" className="h-14 w-full justify-between" onClick={() => p.onCopy(pl.id)}>
              <span className="truncate">{pl.name}</span>
              <ChevronRight className="rtl:rotate-180" aria-hidden />
            </Button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-end gap-3">
            <BuddgyIcon mood="curious" size={52} />
            <div className="flex min-w-0 flex-col gap-1 pb-1">
              <span className={microClassName}>{c.buddgyAsks}</span>
              <h2 className="text-xl font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.title}</h2>
            </div>
          </div>
          <p className="text-[13.5px] text-[var(--color-brand-text-secondary)]">{c.sub}</p>
          {dataMonths > 0 ? (
            <Badge tone="brand" className="self-start">
              <Check aria-hidden />
              {c.usingData(dataMonths)}
            </Badge>
          ) : null}

          {p.drafts.map((d) => (
            <Button key={d.id} variant="outline" className="h-auto w-full justify-start gap-3 py-3 text-start" onClick={() => p.onContinue(d.id)}>
              <TintedTile cat={0} size="md">
                <Hammer />
              </TintedTile>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{c.continueDraft(d.name)}</span>
                <span className="text-xs font-normal text-[var(--color-brand-text-secondary)]">{c.draftSub}</span>
              </span>
              <ChevronRight className="rtl:rotate-180" aria-hidden />
            </Button>
          ))}

          <div className="flex flex-col gap-3">
            {CREATE_INTENTS.map((i) => {
              const ui = INTENT_UI[i]
              return (
                <Button key={i} variant="outline" className="h-auto min-h-[84px] w-full justify-start gap-3.5 rounded-2xl py-3.5 text-start" onClick={() => p.onIntent(i)}>
                  <TintedTile cat={ui.cat} size="lg">
                    <ui.icon />
                  </TintedTile>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[17px] font-semibold">{c.intents[i].name}</span>
                    <span className="whitespace-normal text-[13px] font-normal text-[var(--color-brand-text-secondary)]">{c.intents[i].sub}</span>
                  </span>
                  <ChevronRight className="rtl:rotate-180" aria-hidden />
                </Button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-[var(--color-brand-border)]" />
            <span className="text-xs text-[var(--color-brand-text-muted)]">{c.orBuild}</span>
            <span className="h-px flex-1 bg-[var(--color-brand-border)]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button size="touch" variant="outline" onClick={p.onBlank}>
              <FilePlus aria-hidden />
              {c.blank}
            </Button>
            <Button size="touch" variant="outline" onClick={p.onTemplate}>
              <LayoutTemplate aria-hidden />
              {c.template}
            </Button>
            <Button size="touch" variant="outline" disabled={p.plans.length === 0} onClick={() => setCopying(true)}>
              <Copy aria-hidden />
              {c.copy}
            </Button>
          </div>
        </>
      )}
    </PageBody>
  )
}
