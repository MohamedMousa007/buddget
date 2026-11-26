import type { LucideIcon } from 'lucide-react'
import { goalVisualFor } from '@/lib/goals/goalVisual'
import type { Goal } from '@/lib/store/types'
import { cn } from '@/lib/utils'

/**
 * The goal's icon on its category tint: the one tile every goal surface shows (cards, sheets, pickers, heroes).
 * Give `size` in px, or leave it out and size the tile with `className` (it then fills its slot, e.g. in a picker).
 */
export function GoalGlyph({ goal, icon, size, className }: {
  goal: Pick<Goal, 'category' | 'emoji'>
  /** Overrides the goal's own icon (a goal of your own being edited). */
  icon?: LucideIcon
  size?: number
  className?: string
}) {
  const v = goalVisualFor(goal)
  const Icon = icon ?? v.icon
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center', size === undefined && 'size-full rounded-[inherit]', className)}
      style={{
        ...(size === undefined ? {} : { width: size, height: size, borderRadius: Math.round(size * 0.3) }),
        color: `var(--color-cat-${v.cat})`,
        background: `color-mix(in srgb, var(--color-cat-${v.cat}) 16%, var(--color-brand-card))`,
      }}
    >
      <Icon className="size-[50%]" />
    </span>
  )
}
