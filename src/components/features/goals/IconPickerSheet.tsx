'use client'

import { PickerSheet } from '@/components/ui/PickerSheet'
import { useGoalsLtCopy } from '@/lib/i18n/goalsLtCopy'
import { GOAL_ICON_SET, type GoalIconKey } from '@/lib/goals/goalVisual'
import { cn } from '@/lib/utils'

const KEYS = Object.keys(GOAL_ICON_SET) as GoalIconKey[]

/** Pick the icon of a goal of your own (Other), from the app's own lucide set. Closes on pick. */
export function IconPickerSheet({ open, value, onChange, onClose, subtitle, note }: {
  open: boolean
  value: GoalIconKey | null
  onChange: (icon: GoalIconKey) => void
  onClose: () => void
  /** Who the icon is for, when not a goal (an income source, an installment item). Defaults to the goal wording. */
  subtitle?: string
  note?: string
}) {
  const c = useGoalsLtCopy().goals
  return (
    <PickerSheet open={open} onClose={onClose} title={c.iconTitle} subtitle={subtitle ?? c.iconSub} zIndexClassName="z-[120]">
      <div role="radiogroup" aria-label={c.iconTitle} className="grid grid-cols-5 gap-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3">
        {KEYS.map((k) => {
          const Icon = GOAL_ICON_SET[k]
          const on = k === value
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={k.replace(/-/g, ' ')}
              data-raw-button-ok="an icon cell in the icon grid"
              onClick={() => { onChange(k); onClose() }}
              className={cn(
                'flex h-14 items-center justify-center rounded-xl transition-colors',
                on
                  ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
                  : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]',
              )}
            >
              <Icon className="size-6" aria-hidden />
            </button>
          )
        })}
      </div>
      <p className="px-1 text-xs text-[var(--color-brand-text-muted)]">{note ?? c.iconNote}</p>
    </PickerSheet>
  )
}
