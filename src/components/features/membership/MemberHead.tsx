'use client'

import type { ReactNode } from 'react'
import { User } from 'lucide-react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { Badge } from '@/components/ui/badge'
import { useMemberMarks } from '@/components/features/rewards/useMemberMarks'
import { useLocale, useT } from '@/lib/i18n'
import { displayName, NAME_BUDGET } from '@/lib/profile/displayName'
import { cn } from '@/lib/utils'
import { AvatarBadge, FounderChip } from './AvatarBadge'
import { TierBadge } from './TierBadge'

export interface MemberHeadProps {
  /** `menu`: the profile menu header (name, then tier badge and founder chip). `settings`: the Settings profile row (name, then a hint and the founder chip). */
  variant: 'menu' | 'settings'
  name: string
  avatarSrc: string | null
  /** The muted line under the name on the Settings row. */
  hint?: string
  /** Sits at the end: the bell, or the setup ring and chevron. */
  trailing?: ReactNode
  onNavigate?: () => void
}

/**
 * The person at the top of the profile menu and the Settings page: the avatar with its PRO tag, the name on one line (full when it fits,
 * else the first name), and under it the marks. The whole surface opens the profile; the founder chip opens the Founders club.
 */
export function MemberHead({ variant, name, avatarSrc, hint, trailing, onNavigate }: MemberHeadProps) {
  const t = useT()
  const { locale } = useLocale()
  const marks = useMemberMarks()
  const full = name || t.common.user
  const shown = displayName(full, NAME_BUDGET[variant === 'menu' ? 'menu' : 'row'])
  const ar = locale === 'ar'
  const founder = marks.founderNumber ? (
    <Link href="/settings/founders" onClick={onNavigate} role={variant === 'menu' ? 'menuitem' : undefined} aria-label={marks.line} className="pointer-events-auto relative z-10 -my-3 flex min-h-11 shrink-0 items-center">
      <FounderChip number={marks.founderNumber} />
    </Link>
  ) : null

  return (
    <div className="relative flex items-center gap-3 px-4 py-3">
      <Link href="/settings/profile" onClick={onNavigate} role={variant === 'menu' ? 'menuitem' : undefined} aria-label={full} className="absolute inset-0 transition-colors hover:bg-[var(--color-brand-elevated)]" />
      <AvatarBadge size="sm" proTag={marks.proTag} founder={!!marks.founderNumber} className="pointer-events-none relative mb-1">
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" width={40} height={40} />
        ) : (
          <User className="size-5" aria-hidden />
        )}
      </AvatarBadge>
      <span className={cn('pointer-events-none relative min-w-0 flex-1', ar && 'text-end')}>
        <span dir="auto" className={cn('block truncate font-bold text-[var(--color-brand-text-primary)]', variant === 'menu' ? 'text-sm' : 'text-base')}>{shown}</span>
        <span className={cn('flex min-h-[18px] items-center gap-1.5', ar && 'flex-row-reverse')}>
          {variant === 'menu' ? (
            marks.tier ? (
              <Badge tone="soft" className="h-[18px] shrink-0 gap-1 px-1.5 text-[0.625rem] font-semibold">
                <TierBadge tier={marks.tier} size={12} />
                {marks.tierName}
              </Badge>
            ) : null
          ) : hint ? (
            <span className="truncate text-xs text-[var(--color-brand-text-muted)]">{hint}</span>
          ) : null}
          {founder}
        </span>
      </span>
      {trailing ? <span className="relative z-10 flex shrink-0 items-center">{trailing}</span> : null}
    </div>
  )
}
