import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { SegmentStrip, type Segment } from '@/components/features/membership/SegmentStrip'
import { cn } from '@/lib/utils'

export type MeterLevel = 'ok' | 'warn' | 'full'

/** Teal under 80%, amber from 80%, red at 100%. */
export function meterLevel(pct: number | null): MeterLevel {
  return pct !== null && pct >= 100 ? 'full' : pct !== null && pct >= 80 ? 'warn' : 'ok'
}

const FILL: Record<MeterLevel, string> = {
  ok: 'bg-[var(--color-brand-primary-hover)]',
  warn: 'bg-[var(--color-brand-amber)]',
  full: 'bg-[var(--color-brand-red)]',
}
const TEXT: Record<MeterLevel, string> = {
  ok: 'text-[var(--color-brand-text-primary)]',
  warn: 'text-[var(--color-brand-amber)]',
  full: 'text-[var(--color-brand-red)]',
}

interface PercentProps {
  kind?: 'percent'
  label: string
  /** 0-100, or null when the plan has no limit (the meter is then not drawn). */
  pct: number | null
  /** The value text, e.g. "42%". */
  value: string
  /** "Resets at 18:40" or "Limit reached". */
  note?: string
}

interface CountProps {
  kind: 'count'
  label: string
  used: number
  limit: number
  value: string
  note?: string
}

/** One segment per allowed use, filled for those used. */
export function countSegments(used: number, limit: number): Segment[] {
  return Array.from({ length: Math.max(1, limit) }, (_, i) => (i < used ? 'kept' : 'empty'))
}

/**
 * One usage meter: a label, a value and a reset line. `percent` is a 6px track; `count` (balance views, plans) is a segment strip.
 * Percentages only: credits stay internal. The same meter sits on the Usage page, the Pro page, the limit sheet and the chat.
 */
export function UsageMeter(props: PercentProps | CountProps) {
  const level = props.kind === 'count' ? meterLevel((props.used / Math.max(1, props.limit)) * 100) : meterLevel(props.pct)
  return (
    <div className="flex flex-col gap-1.5" data-level={level}>
      <div dir="auto" className="flex items-baseline justify-between gap-2">
        <span className="text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">{props.label}</span>
        <span dir="ltr" className={cn('font-mono-numbers text-[0.8125rem] font-semibold', TEXT[level])}>{props.value}</span>
      </div>
      {props.kind === 'count' ? (
        <SegmentStrip label={props.label} segments={countSegments(props.used, props.limit)} />
      ) : props.pct === null ? null : (
        <Progress value={Math.min(100, Math.max(0, props.pct))} aria-label={props.label}>
          <ProgressTrack className="h-1.5 bg-[var(--color-brand-sunken)]">
            <ProgressIndicator className={FILL[level]} />
          </ProgressTrack>
        </Progress>
      )}
      {props.note ? <span dir="auto" className="text-xs text-[var(--color-brand-text-secondary)]">{props.note}</span> : null}
    </div>
  )
}
