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

/** Track plus four checkpoint nodes (25/50/75/100%). `nodes={false}` is the plain bar used by limit goals. */
export function CheckpointBar({
  percent,
  tone = 'default',
  nodes = true,
  className,
}: {
  percent: number
  tone?: CheckpointTone
  nodes?: boolean
  className?: string
}) {
  const t = useT().goals.home
  const pct = Math.max(0, Math.min(100, percent))
  const reached = NODES.filter((n) => pct >= n).length
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
