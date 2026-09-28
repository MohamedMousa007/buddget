'use client'

import { cn } from '@/lib/utils'

export interface ScrimProps extends Omit<React.ComponentProps<'button'>, 'children'> {
  /** Accessible name for the dismiss action, e.g. "Close filters". */
  label: string
  /**
   * How much the scrim darkens what is behind it. `none` is an invisible
   * click-catcher — for dismissing a popover menu without dimming the screen.
   */
  tone?: 'default' | 'light' | 'heavy' | 'none'
  /** Blur the content behind. Off for a scrim over a scrolling list — it costs a repaint per frame. */
  blur?: boolean
}

/**
 * The tap-to-dismiss backdrop behind a sheet or dialog.
 *
 * It is a real `<button>` rather than a `<div onClick>` so it is reachable by
 * keyboard and announced as an action — a div would leave keyboard users with no
 * way out but Escape, and nothing telling them it is there.
 *
 * It does **not** handle Escape or Android hardware-back. Those belong to the
 * overlay itself, via `ModalShell` or {@link useDismissable}, because only the
 * overlay knows what closing means. Rendering a Scrim without one of those leaves
 * the sheet dismissable by tap but not by back.
 *
 * ```tsx
 * <Scrim label={t.common.close} onClick={onClose} />
 * ```
 */
export function Scrim({
  className,
  label,
  tone = 'default',
  blur,
  type = 'button',
  ...props
}: ScrimProps) {
  // An invisible catcher must not blur, or it stops being invisible.
  const blurred = blur ?? tone !== 'none'
  return (
    <button
      data-slot="scrim"
      type={type}
      aria-label={label}
      className={cn(
        'absolute inset-0 cursor-default border-none outline-none',
        tone === 'none'
          ? 'bg-transparent'
          : tone === 'light'
            ? 'bg-black/25'
            : tone === 'heavy'
              ? 'bg-black/65'
              : 'bg-black/40',
        blurred && 'backdrop-blur-md',
        className
      )}
      {...props}
    />
  )
}
