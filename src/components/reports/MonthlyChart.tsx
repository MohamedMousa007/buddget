'use client'

import { useEffect, useState, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface MonthlyChartProps {
  data: { month: string; income: number; expenses: number; savings: number }[]
  currency: string
}

export function MonthlyChart({ data, currency }: MonthlyChartProps) {
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
        Month by Month
      </h3>
      <p className="text-[10px] text-[var(--color-brand-text-muted)] mb-4">
        Your income, spending, and savings for each month at a glance.
      </p>
      {data.length === 0 ? (
        <p className="text-[var(--color-brand-text-muted)] text-sm text-center py-8">
          Nothing here yet — add some transactions to see your trends
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
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-brand-elevated)',
                  border: '1px solid var(--color-brand-border)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value) => [`${currency} ${Number(value).toLocaleString('en-US')}`, undefined]}
              />
              <Legend
                wrapperStyle={{ color: 'var(--color-brand-text-secondary)', fontSize: 12 }}
              />
              <Bar dataKey="income" fill="var(--color-brand-green)" radius={[4, 4, 0, 0]} name="Money in" />
              <Bar dataKey="expenses" fill="var(--color-brand-red)" radius={[4, 4, 0, 0]} name="Money out" />
              <Bar dataKey="savings" fill="var(--color-brand-gold)" radius={[4, 4, 0, 0]} name="Saved" />
            </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      )}
    </div>
  )
}
