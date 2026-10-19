'use client'

import { useState } from 'react'
import { Activity, Coins, Flag, Send } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { CheckpointBar } from '@/components/features/goals/CheckpointBar'
import { Button } from '@/components/ui/button'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useT } from '@/lib/i18n'
import { goalVisual } from '@/lib/goals/goalVisual'
import type { GoalCategory } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'

const MOMENTS = [
  ['emergency', 'emergency_fund'],
  ['vacation', 'vacation'],
  ['car', 'car'],
  ['home', 'house'],
  ['education', 'education'],
  ['other', 'custom'],
] as const

export interface StartGoalSeed {
  category?: GoalCategory
  text?: string
}

/** First run: Buddgy asks what the user is looking forward to, six life moments, and what every goal includes. */
export function GoalsEmpty({ onStart }: { onStart: (seed: StartGoalSeed) => void }) {
  const t = useT().goals.empty
  const { online } = useNetworkStatus()
  const [text, setText] = useState('')
  const submit = () => onStart({ text: text.trim() || undefined })
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
      <section className="flex flex-col gap-2.5 rounded-3xl lg:col-span-3 lg:px-6 lg:py-5 bg-[var(--color-brand-primary-soft)] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-card)] shadow-sm">
            <BuddgyIcon mood="happy" size={32} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{t.headline}</h2>
            <p className="text-[13px] text-[var(--color-brand-text-secondary)]">{t.body}</p>
          </div>
        </div>
        {online ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <Input
              size="brand"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.placeholder}
              aria-label={t.headline}
              className="h-11 flex-1 rounded-full bg-[var(--color-brand-card)] px-4"
            />
            <IconButton type="submit" variant="solid" shape="round" aria-label={t.send}>
              <Send />
            </IconButton>
          </form>
        ) : null}
      </section>

      <h3 className={`${microClassName} lg:col-span-3`}>{t.momentsLabel}</h3>
      <div className="grid grid-cols-2 gap-2 lg:col-span-3 lg:grid-cols-3 lg:gap-3">
        {MOMENTS.map(([key, category]) => {
          const { icon: Icon, cat } = goalVisual(category)
          return (
            <SelectableCard
              key={key}
              as="action"
              layout="row"
              surface="card"
              onClick={() => onStart({ category })}
              className="min-h-[52px] gap-2.5 rounded-2xl p-2.5"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                style={{ color: `var(--color-cat-${cat})`, background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))` }}
                aria-hidden
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-col text-start">
                <span className="truncate text-[13px] font-semibold text-[var(--color-brand-text-primary)]">{t.moments[key].title}</span>
                <span className="truncate text-[11px] text-[var(--color-brand-text-secondary)]">{t.moments[key].sub}</span>
              </span>
            </SelectableCard>
          )
        })}
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-dashed border-[var(--color-brand-border)] p-3 lg:col-span-3 lg:p-5">
        <h3 className={microClassName}>{t.includesTitle}</h3>
        <CheckpointBar percent={50} />
        {[
          [Flag, t.includeCheckpoints],
          [Activity, t.includePace],
          [Coins, t.includePocket],
        ].map(([Icon, line]) => (
          <p key={line as string} className="flex items-center gap-2.5 text-[13px] text-[var(--color-brand-text-secondary)]">
            <Icon className="size-4 shrink-0 text-[var(--color-brand-primary-bright)]" aria-hidden />
            {line as string}
          </p>
        ))}
      </section>

      <Button size="touch" variant="outline" className="w-full lg:col-span-3 lg:mx-auto lg:w-72" onClick={() => onStart({})}>
        {t.startScratch}
      </Button>
    </div>
  )
}
