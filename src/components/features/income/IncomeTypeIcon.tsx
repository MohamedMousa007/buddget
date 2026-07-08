'use client'

import type { IncomeSourceType } from '@/lib/store/types'
import { incomeTypeGridItem } from '@/lib/constants/categoryGrid'
import { cn } from '@/lib/utils'
import { rgba } from '@/lib/utils/color'

/** Unique Lucide glyph per income source type, from the canonical INCOME_TYPE_GRID. */
export function IncomeTypeIcon({
  type,
  className,
  style,
}: {
  type: IncomeSourceType | undefined
  className?: string
  style?: React.CSSProperties
}) {
  const Icon = incomeTypeGridItem(type).icon
  return <Icon className={cn('shrink-0', className)} style={style} />
}

/** Foreground + translucent background for an income source type (icon tiles). */
export function incomeTypeColors(type: IncomeSourceType | undefined): { fg: string; bg: string } {
  const accent = incomeTypeGridItem(type).accent
  return { fg: accent, bg: rgba(accent, 0.13) }
}
