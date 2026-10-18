'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { goalCategoryLabelKey } from '@/components/features/goals/goalCategoryLabel'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useT } from '@/lib/i18n'
import { goalVisual } from '@/lib/goals/goalVisual'
import type { GoalCategory } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'

const SAVE: GoalCategory[] = [
  'emergency_fund', 'house', 'car', 'vacation', 'education', 'wedding', 'retirement', 'business',
  'phone_device', 'gift', 'investment', 'family_support', 'sadaqah_charity', 'quality_of_life', 'custom',
]

function Tile({ category, label, onPick }: { category: GoalCategory; label: string; onPick: () => void }) {
  const { icon: Icon, cat } = goalVisual(category)
  return (
    <SelectableCard as="action" layout="stack" surface="card" onClick={onPick} className="min-h-11 items-center gap-1.5 p-2">
      <span
        className="flex size-10 items-center justify-center rounded-[14px]"
        style={{ color: `var(--color-cat-${cat})`, background: `color-mix(in srgb, var(--color-cat-${cat}) 16%, var(--color-brand-card))` }}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <span className="text-center text-[11px] font-semibold leading-tight text-[var(--color-brand-text-primary)]">{label}</span>
    </SelectableCard>
  )
}

export function StepDescribe({
  parsing,
  parseError,
  onDescribe,
  onPick,
}: {
  parsing: boolean
  parseError: boolean
  onDescribe: (text: string) => void
  onPick: (c: GoalCategory) => void
}) {
  const t = useT().goals
  const f = t.flow.s1
  const { online } = useNetworkStatus()
  const [text, setText] = useState('')
  const group = (label: string, items: { c: GoalCategory; label: string }[]) => (
    <div className="flex flex-col gap-2">
      <h3 className={microClassName}>{label}</h3>
      <div className="grid grid-cols-4 gap-2">
        {items.map((i) => (
          <Tile key={i.label} category={i.c} label={i.label} onPick={() => onPick(i.c)} />
        ))}
      </div>
    </div>
  )
  return (
    <>
      <div>
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{f.title}</h2>
        <p className="mt-1 text-sm text-[var(--color-brand-text-secondary)]">{f.sub}</p>
      </div>
      {online ? (
        <form
          className="flex flex-col gap-2.5 rounded-2xl bg-[var(--color-brand-primary-soft)] p-3.5"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim() && !parsing) onDescribe(text.trim())
          }}
        >
          <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-brand-text-primary)]">
            <BuddgyIcon size={24} mood={parsing ? 'thinking' : 'idle'} />
            {parsing ? f.reading : f.buddgyLine}
          </p>
          <div className="flex items-center gap-2">
            <Input
              size="brand"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={f.placeholder}
              aria-label={f.buddgyLine}
              className="h-12 flex-1 rounded-full bg-[var(--color-brand-card)] px-4"
            />
            <IconButton type="submit" variant="solid" size="lg" shape="round" aria-label={f.send} disabled={parsing || !text.trim()}>
              <Send />
            </IconButton>
          </div>
          {parseError ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{f.parseFailed}</p> : null}
        </form>
      ) : null}
      {group(f.groupSave, SAVE.map((c) => ({ c, label: t[goalCategoryLabelKey(c)] as string })))}
      {group(f.groupPay, [
        { c: 'debt_freedom', label: f.payDebt },
        { c: 'debt_freedom', label: f.payCard },
      ])}
      {group(f.groupControl, [
        { c: 'spending_control', label: f.limitMonthly },
        { c: 'spending_control', label: f.limitCategory },
      ])}
    </>
  )
}
