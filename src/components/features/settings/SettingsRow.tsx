'use client'

import type { ComponentType, CSSProperties, ReactNode } from 'react'
import { AppLink as Link } from '@/components/ui/AppLink'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Which category hue tints the icon chip; `neutral` is the plain elevated chip. */
export type RowTone = 1 | 2 | 3 | 4 | 5 | 6 | 'neutral'

interface SettingsRowProps {
  icon?: ComponentType<{ className?: string }>
  tone?: RowTone
  title: string
  subtitle?: string
  /** Current value, shown mono at the end of the row before the chevron. */
  value?: string
  href?: string
  onClick?: () => void
  trailing?: ReactNode
  destructive?: boolean
  /** Lets settings search scroll to and highlight this row. */
  settingId?: string
}

export function SettingsChip({ icon: Icon, tone = 'neutral', destructive = false }: { icon: ComponentType<{ className?: string }>; tone?: RowTone; destructive?: boolean }) {
  const hue = destructive ? 'var(--color-brand-red)' : tone === 'neutral' ? undefined : `var(--color-cat-${tone})`
  const style: CSSProperties | undefined = hue
    ? { color: hue, background: `color-mix(in oklab, ${hue} 15%, var(--color-brand-card))` }
    : undefined
  return (
    <span
      style={style}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover/row:-rotate-6 group-hover/row:scale-110',
        !hue && 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]',
      )}
    >
      <Icon className="size-[19px]" />
    </span>
  )
}

export function SettingsRow({
  icon,
  tone = 'neutral',
  title,
  subtitle,
  value,
  href,
  onClick,
  trailing,
  destructive = false,
  settingId,
}: SettingsRowProps) {
  const { locale } = useLocale()
  const isRtl = locale === 'ar'

  const defaultTrailing = trailing ?? (
    isRtl
      ? <ChevronLeft className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" />
      : <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" />
  )

  const content = (
    <>
      {icon ? <SettingsChip icon={icon} tone={tone} destructive={destructive} /> : null}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[15px] font-semibold leading-tight', destructive ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]', isRtl && 'text-end')}>
          {title}
        </span>
        {subtitle ? (
          <span className={cn('mt-0.5 block text-xs leading-snug text-[var(--color-brand-text-muted)]', isRtl && 'text-end')}>
            {subtitle}
          </span>
        ) : null}
      </span>
      {value ? <span className="font-mono-numbers shrink-0 text-xs text-[var(--color-brand-text-muted)]">{value}</span> : null}
      {defaultTrailing}
    </>
  )

  const baseClass =
    'group/row flex items-center gap-3 px-4 min-h-14 w-full text-start transition-[background-color,transform] duration-200 hover:bg-[var(--color-brand-elevated)] active:scale-[0.985] py-2'

  if (href) {
    return <Link href={href} data-setting-id={settingId} className={baseClass}>{content}</Link>
  }

  return (
    <button type="button" data-setting-id={settingId} onClick={onClick} className={baseClass}>
      {content}
    </button>
  )
}
