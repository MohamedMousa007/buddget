'use client'

import { AppLink as Link } from '@/components/ui/AppLink'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useLocale } from '@/lib/i18n'
import type { LucideIcon } from 'lucide-react'

interface SettingsRowProps {
  icon?: LucideIcon
  iconColor?: string
  title: string
  subtitle?: string
  href?: string
  onClick?: () => void
  trailing?: React.ReactNode
  destructive?: boolean
}

export function SettingsRow({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  href,
  onClick,
  trailing,
  destructive = false,
}: SettingsRowProps) {
  const { locale } = useLocale()
  const isRtl = locale === 'ar'

  const defaultTrailing = trailing ?? (
    isRtl
      ? <ChevronLeft className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
      : <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-brand-text-muted)]" />
  )

  const content = (
    <>
      {Icon && (
        <span className="w-8 h-8 rounded-xl bg-[var(--color-brand-elevated)] shrink-0 flex items-center justify-center">
          <Icon className={`h-4 w-4 ${destructive ? 'text-[var(--color-brand-red)]' : (iconColor ?? 'text-[var(--color-brand-text-secondary)]')}`} />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium leading-tight ${destructive ? 'text-[var(--color-brand-red)]' : 'text-[var(--color-brand-text-primary)]'}`}>
          {title}
        </span>
        {subtitle && (
          <span className="block text-xs text-[var(--color-brand-text-muted)] mt-0.5 leading-tight">
            {subtitle}
          </span>
        )}
      </span>
      {defaultTrailing}
    </>
  )

  const baseClass = 'flex items-center gap-3 px-4 min-h-11 w-full text-start transition-colors hover:bg-[var(--color-brand-elevated)] py-2'

  if (href) {
    return <Link href={href} className={baseClass}>{content}</Link>
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {content}
    </button>
  )
}
