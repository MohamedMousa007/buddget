'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface MonthlyChartProps {
  data: { month: string; income: number; expenses: number; savings: number }[]
  currency: string
}

export function MonthlyChart({ data, currency }: MonthlyChartProps) {
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
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A38" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#A0A0B8', fontSize: 12 }}
                axisLine={{ stroke: '#2A2A38' }}
              />
              <YAxis
                tick={{ fill: '#A0A0B8', fontSize: 12 }}
                axisLine={{ stroke: '#2A2A38' }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A24',
                  border: '1px solid #2A2A38',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value) => [`${currency} ${Number(value).toLocaleString()}`, undefined]}
              />
              <Legend
                wrapperStyle={{ color: '#A0A0B8', fontSize: 12 }}
              />
              <Bar dataKey="income" fill="#1DB954" radius={[4, 4, 0, 0]} name="Money in" />
              <Bar dataKey="expenses" fill="#E50914" radius={[4, 4, 0, 0]} name="Money out" />
              <Bar dataKey="savings" fill="#F5C842" radius={[4, 4, 0, 0]} name="Saved" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
