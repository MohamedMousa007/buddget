'use client'

import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { formatCurrency } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: number
  currency: string
  trend?: number
  trendLabel?: string
  /** Short note under the trend line (e.g. income not declared). */
  footnote?: string
  color?: 'default' | 'green' | 'red' | 'gold'
  icon?: React.ReactNode
  onClick?: () => void
}

const COLOR_MAP = {
  default: 'text-white',
  green: 'text-[var(--color-brand-green)]',
  red: 'text-[var(--color-brand-red)]',
  gold: 'text-[var(--color-brand-gold)]',
}

export function KPICard({
  title,
  value,
  currency,
  trend,
  trendLabel,
  footnote,
  color = 'default',
  icon,
  onClick,
}: KPICardProps) {
  const { settings, exchangeRates } = useFinanceStore()
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : null

  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) =>
    formatCurrency(latest, currency)
  )
  const displayRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1.2,
      ease: 'easeOut',
    })
    return controls.stop
  }, [value, count])

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      if (displayRef.current) {
        displayRef.current.textContent = v
      }
    })
    return unsubscribe
  }, [rounded])

  const secondaryValue = secondary
    ? convertCurrency(value, currency, secondary, exchangeRates)
    : null

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'glass-card rounded-2xl p-5 min-w-[180px] hover:shadow-lg hover:shadow-black/20 transition-shadow duration-200',
        onClick ? 'cursor-pointer' : 'cursor-default'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-lg">{icon}</span>}
        <p className="text-xs font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {title}
        </p>
      </div>
      <p className={cn('text-2xl font-bold font-mono-numbers', COLOR_MAP[color])}>
        <span ref={displayRef}>{formatCurrency(0, currency)}</span>
      </p>
      {secondaryValue != null && (
        <p className="text-xs text-[var(--color-brand-text-muted)] font-mono-numbers mt-0.5">
          ({formatCurrency(secondaryValue, secondary!)})
        </p>
      )}
      {(trend !== undefined || trendLabel) && (
        <p className="text-xs text-[var(--color-brand-text-muted)] mt-1">
          {trend !== undefined && (
            <span
              className={cn(
                'me-1',
                trend >= 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'
              )}
            >
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
          {trendLabel}
        </p>
      )}
      {footnote ? (
        <p className="text-[10px] text-[var(--color-brand-text-muted)] mt-2 leading-snug">{footnote}</p>
      ) : null}
    </motion.div>
  )
}
