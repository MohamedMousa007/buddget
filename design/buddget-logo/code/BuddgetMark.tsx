import { useId } from 'react'

/**
 * Buddget mark: the coin b. 48-unit grid, geometry is fixed; do not edit path data.
 * variant: 'brand' (identity teal, follows light/dark via token), 'gradient', 'mono' (currentColor), 'on-teal' (white).
 * Minimum size 16px. The 48 box includes built-in padding; bbox is x 11-38, y 5-42.
 */
type Props = { size?: number; variant?: 'brand' | 'gradient' | 'mono' | 'on-teal'; className?: string; title?: string }

export function BuddgetMark({ size = 26, variant = 'brand', className, title }: Props) {
  const id = useId().replace(/:/g, '')
  const fill =
    variant === 'mono' ? 'currentColor'
    : variant === 'on-teal' ? '#FFFFFF'
    : variant === 'gradient' ? `url(#bm-${id})`
    : 'var(--color-brand-primary-bright, #12B0A0)'
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} dir="ltr">
      {variant === 'gradient' && (
        <defs>
          <linearGradient id={`bm-${id}`} gradientUnits="userSpaceOnUse" x1="18" y1="5" x2="31" y2="42">
            <stop offset="0" stopColor="var(--color-brand-primary-bright, #12B0A0)" />
            <stop offset="1" stopColor="#0B7568" />
          </linearGradient>
        </defs>
      )}
      <g fill={fill}>
        <rect x="11" y="5" width="6" height="37" rx="3" />
        <path fillRule="evenodd" d="M14 30a12 12 0 1 0 24 0a12 12 0 1 0 -24 0ZM20 30a6 6 0 1 0 12 0a6 6 0 1 0 -12 0Z" />
        <circle cx="26" cy="30" r="3.5" />
      </g>
    </svg>
  )
}
