import { cn } from '@/lib/utils'

export type Confidence = 'high' | 'medium' | 'low'
const BARS: Record<Confidence, number> = { high: 3, medium: 2, low: 1 }

/** Three bars, 6 / 10 / 14 px tall: filled `primary-bright` up to the confidence, the rest `border`. */
export function ConfidenceMeter({ level }: { level: Confidence }) {
  return (
    <span aria-hidden className="flex items-end gap-[3px]">
      {[6, 10, 14].map((h, i) => (
        <span
          key={h}
          style={{ height: h }}
          className={cn(
            'w-[5px] rounded-[2px]',
            i < BARS[level] ? 'bg-[var(--color-brand-primary-bright)]' : 'bg-[var(--color-brand-border)]',
          )}
        />
      ))}
    </span>
  )
}
