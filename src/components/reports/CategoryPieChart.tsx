'use client'

import { useEffect, useState, useRef } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'

interface CategoryPieChartProps {
  data: { name: string; value: number }[]
  currency: string
}

const COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-cat-${n})`)
const OTHER_COLOR = 'var(--color-brand-text-muted)'

/** Top slices keep a distinct token colour; the long tail folds into one neutral "Other" slice so no colour repeats. */
export function foldTail(data: { name: string; value: number }[], otherName = 'Other'): { name: string; value: number; folded?: boolean }[] {
  if (data.length <= COLORS.length) return data
  const head = data.slice(0, COLORS.length - 1)
  const rest = data.slice(COLORS.length - 1).reduce((s, d) => s + d.value, 0)
  return [...head, { name: otherName, value: rest, folded: true }]
}

export function CategoryPieChart({ data, currency }: CategoryPieChartProps) {
  const c = useT().reports.chart
  const [mounted, setMounted] = useState(false)
  const rafRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => setMounted(true))
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const slices = foldTail(data, c.other)
  const total = slices.reduce((s, d) => s + d.value, 0)

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
        {c.pieTitle}
      </h3>
      {data.length === 0 ? (
        <p className="text-[var(--color-brand-text-muted)] text-sm text-center py-8">
          {c.pieEmpty}
        </p>
      ) : (
        <div className="h-72 min-h-72 min-w-24">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {slices.map((d, index) => (
                  <Cell key={index} fill={d.folded ? OTHER_COLOR : COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-brand-elevated)',
                  border: '1px solid var(--color-brand-border)',
                  borderRadius: '12px',
                  color: 'var(--color-brand-text-primary)',
                }}
                formatter={(value, name) => [`${formatCurrency(Number(value), currency)} (${total > 0 ? Math.round((Number(value) / total) * 100) : 0}%)`, name]}
              />
              <Legend
                wrapperStyle={{ color: 'var(--color-brand-text-secondary)', fontSize: 12 }}
              />
            </PieChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      )}
    </div>
  )
}
