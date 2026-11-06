import { AlertTriangle, Calendar, Check, Flag, Flame, Pause, type LucideIcon } from 'lucide-react'
import type { GoalStatusView } from '@/lib/goals/goalStatus'
import { cn } from '@/lib/utils'

const ICON: Record<GoalStatusView['icon'], LucideIcon> = { AlertTriangle, Calendar, Check, Flame, Flag, Pause }
const COLOR: Record<GoalStatusView['tone'], string> = {
  red: 'var(--color-brand-red)',
  ink: 'var(--color-brand-primary-ink)',
  amber: 'var(--color-brand-amber)',
  green: 'var(--color-brand-green)',
  muted: 'var(--color-brand-text-muted)',
}
const STRONG: ReadonlySet<GoalStatusView['kind']> = new Set(['over', 'due', 'behind', 'oneDeposit'])

/** The one status line on a goal card: icon + single-line text. Never colour alone. */
export function GoalStatusLine({ view, text }: { view: GoalStatusView; text: string }) {
  const Icon = ICON[view.icon]
  const strong = STRONG.has(view.kind)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Icon className="size-4 shrink-0" style={{ color: COLOR[view.tone] }} aria-hidden />
      <span
        className={cn(
          'truncate text-[0.8125rem]',
          strong ? 'font-semibold text-[var(--color-brand-text-primary)]' : 'font-medium text-[var(--color-brand-text-secondary)]',
        )}
      >
        {text}
      </span>
    </div>
  )
}
