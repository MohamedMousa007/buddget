import { cn } from '@/lib/utils'
import s from './ProMark.module.css'

export interface ProMarkProps {
  /** `md` matches a settings row icon (36px); `sm` is 26px; `lg` is the 64px tile on the Pro page header. */
  size?: 'sm' | 'md' | 'lg'
  /** A plan that has ended: the same tile, drained of colour. */
  faded?: boolean
  /** The gold word. A brand mark, so it is not translated. */
  label?: string
  className?: string
}

/** The one way to show Pro: the Pro card's face as a tile, a blind-embossed b, PRO in gold foil. Decorative; the row beside it names the plan. */
export function ProMark({ size = 'md', faded = false, label = 'PRO', className }: ProMarkProps) {
  return (
    <span dir="ltr" data-pro-mark={size} data-faded={faded || undefined} aria-hidden className={cn(s.mark, s[size], faded && s.faded, className)}>
      <span className={s.b}>b</span>
      <span className={s.pro}>{label}</span>
    </span>
  )
}
