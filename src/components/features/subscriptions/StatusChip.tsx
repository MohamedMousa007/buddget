import { Check, Clock, Repeat, TrendingUp, TriangleAlert, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Chip, ChipIcon, ChipTone } from '@/lib/subscriptions/subscriptionRows'
import { cn } from '@/lib/utils'

const ICONS: Record<ChipIcon, typeof Clock> = {
  clock: Clock,
  'trending-up': TrendingUp,
  repeat: Repeat,
  'triangle-alert': TriangleAlert,
  users: Users,
  check: Check,
}

const TONE: Record<ChipTone, 'muted' | 'warning' | 'brand' | 'positive'> = {
  neutral: 'muted',
  amber: 'warning',
  info: 'brand',
  success: 'positive',
}

/** Badge preset for a subscription's state: 11/600, 2/8 padding, text stays primary for contrast on every tint. */
export function StatusChip({
  tone,
  icon,
  className,
  children,
}: {
  tone: Chip['tone']
  icon?: Chip['icon']
  className?: string
  children: React.ReactNode
}) {
  const Icon = icon ? ICONS[icon] : null
  return (
    <Badge
      variant={TONE[tone]}
      className={cn('h-auto gap-1 px-2 py-0.5 font-sans text-[11px] font-semibold text-[var(--color-brand-text-primary)]', className)}
    >
      {Icon ? <Icon className="!size-[11px]" strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </Badge>
  )
}
