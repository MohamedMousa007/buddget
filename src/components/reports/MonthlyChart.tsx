'use client'

import { useEffect, useState, useRef } from 'react'
import { formatCurrency } from '@/lib/utils/formatters'
import { useT } from '@/lib/i18n'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface MonthlyChartProps {
  data: { month: string; income: number; expenses: number; savings: number }[]
  currency: string
}

/** Compact Y-axis tick: "500", "1.5k", "-2k". Never "0k" for a non-zero value. */
export function axisTick(v: number): string {
  const abs = Math.abs(v)
  if (abs < 1000) return String(Math.round(v) + 0)
  return `${v < 0 ? '-' : ''}${Number((abs / 1000).toFixed(1))}k`
}

export function MonthlyChart({ data, currency }: MonthlyChartProps) {
  const t = useT()
  const c = t.reports.chart
  const [mounted, setMounted] = useState(false)
  const rafRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => setMounted(true))
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-1">
        {c.monthTitle}
      </h3>
      <p className="text-[0.625rem] text-[var(--color-brand-text-muted)] mb-4">
        {c.monthHint}
      </p>
      {data.length === 0 ? (
        <p className="text-[var(--color-brand-text-muted)] text-sm text-center py-8">
          {c.monthEmpty}
        </p>
      ) : (
        <div className="h-72 min-h-72 min-w-24">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-border)" />
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--color-brand-text-secondary)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--color-brand-border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--color-brand-text-secondary)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--color-brand-border)' }}
                tickFormatter={axisTick}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-brand-elevated)',
                  border: '1px solid var(--color-brand-border)',
                  borderRadius: '12px',
                  color: 'var(--color-brand-text-primary)',
                }}
                formatter={(value, name) => [formatCurrency(Number(value), currency), name]}
              />
              <Legend
                wrapperStyle={{ color: 'var(--color-brand-text-secondary)', fontSize: 12 }}
              />
              <Bar dataKey="income" fill="var(--color-brand-green)" radius={[4, 4, 0, 0]} name={c.moneyIn} />
              <Bar dataKey="expenses" fill="var(--color-brand-primary)" radius={[4, 4, 0, 0]} name={c.moneyOut} />
              <Bar dataKey="savings" fill="var(--color-brand-gold)" radius={[4, 4, 0, 0]} name={c.saved} />
            </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      )}
    </div>
  )
}
