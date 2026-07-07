'use client'

import { useEffect, useState, useRef } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatCurrency } from '@/lib/utils/formatters'

interface CategoryPieChartProps {
  data: { name: string; value: number }[]
  currency: string
}

const COLORS = ['var(--color-brand-red)', 'var(--color-brand-green)', 'var(--color-brand-gold)', 'var(--color-brand-amber)', '#3B82F6', '#A855F7', '#EC4899', '#6B7280']

export function CategoryPieChart({ data, currency }: CategoryPieChartProps) {
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
      <h3 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider mb-4">
        Where It Goes
      </h3>
      {data.length === 0 ? (
        <p className="text-[var(--color-brand-text-muted)] text-sm text-center py-8">
          No spending yet — your breakdown will appear here
        </p>
      ) : (
        <div className="h-72 min-h-72 min-w-24">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-brand-elevated)',
                  border: '1px solid var(--color-brand-border)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value) => [formatCurrency(Number(value), currency), undefined]}
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
