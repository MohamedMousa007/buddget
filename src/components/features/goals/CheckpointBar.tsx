import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type CheckpointTone = 'default' | 'behind' | 'over' | 'paused'

const FILL: Record<CheckpointTone, string> = {
  default: 'var(--color-brand-primary-bright)',
  behind: 'var(--color-brand-amber)',
  over: 'var(--color-brand-red)',
  paused: 'var(--color-brand-text-muted)',
}

const NODES = [25, 50, 75, 100] as const

const MARKS = [25, 50, 75] as const

/**
 * Track plus four checkpoint nodes (25/50/75/100%). `nodes={false}` is the plain bar used by limit goals.
 * `look="marks"` is the Light touch bar: a thicker track with a small mark at 25, 50 and 75%, filled once passed
 * (`size="lg"` in the goal sheet).
 */
export function CheckpointBar({
  percent,
  tone = 'default',
  nodes = true,
  look = 'nodes',
  size = 'sm',
  className,
}: {
  percent: number
  tone?: CheckpointTone
  nodes?: boolean
  look?: 'nodes' | 'marks'
  size?: 'sm' | 'lg'
  className?: string
}) {
  const t = useT().goals.home
  const pct = Math.max(0, Math.min(100, percent))
  const reached = NODES.filter((n) => pct >= n).length
  if (look === 'marks') {
    return (
      <div
        role="img"
        aria-label={t.checkpointsAria(Math.round(pct), nodes ? reached : 0)}
        className={cn('relative flex-none rounded-full bg-[var(--color-brand-sunken)]', size === 'lg' ? 'h-2.5' : 'h-2', className)}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone === 'default' ? 'var(--color-brand-primary)' : FILL[tone] }} />
        {nodes
          ? MARKS.map((n) => (
              <span
                key={n}
                aria-hidden
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-brand-card)] rtl:translate-x-1/2 ltr:-translate-x-1/2',
                  size === 'lg' ? 'size-3.5' : 'size-2.5',
                  pct >= n ? 'bg-[var(--color-brand-primary)]' : 'bg-[var(--color-brand-border-strong)]',
                )}
                style={{ insetInlineStart: `${n}%` }}
              />
            ))
          : null}
      </div>
    )
  }
  return (
    <div
      role="img"
      aria-label={t.checkpointsAria(Math.round(pct), nodes ? reached : 0)}
      className={cn('relative h-4 flex-none', className)}
    >
      <div className="absolute inset-x-0 top-[5px] h-1.5 rounded-full bg-[var(--color-brand-elevated)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: FILL[tone] }} />
      </div>
      {nodes
        ? NODES.map((n) => {
            const on = pct >= n
            return (
              <span
                key={n}
                className={cn(
                  'absolute top-0 flex size-4 items-center justify-center rounded-full border-2',
                  on
                    ? 'border-[var(--color-brand-card)] bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
                    : 'border-[var(--color-brand-border)] bg-[var(--color-brand-card)]',
                )}
                style={{ insetInlineStart: n === 100 ? 'calc(100% - 16px)' : `calc(${n}% - 8px)` }}
              >
                {on ? <Check className="size-2.5" strokeWidth={3} aria-hidden /> : null}
              </span>
            )
          })
        : null}
    </div>
  )
}
