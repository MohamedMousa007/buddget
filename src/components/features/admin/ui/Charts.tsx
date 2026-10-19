'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { num } from '../format'

const AXIS = { fontSize: 11, fill: 'var(--color-brand-text-muted)' }
const TOOLTIP_STYLE = {
  background: 'var(--color-brand-card)',
  border: '1px solid var(--color-brand-border)',
  borderRadius: 12,
  fontSize: 12,
  boxShadow: 'var(--shadow-md)',
}

export interface Series {
  key: string
  label: string
  color: string
}

export const CHART = {
  one: 'var(--chart-1)',
  two: 'var(--chart-2)',
  three: 'var(--chart-3)',
  four: 'var(--chart-4)',
  five: 'var(--chart-5)',
} as const

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function TrendChart({ data, series, height = 220, xKey = 'day' }: { data: Array<Record<string, string | number>>; series: readonly Series[]; height?: number; xKey?: string }) {
  return (
    <div style={{ height }} role="img" aria-label={`Trend of ${series.map((s) => s.label).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--color-brand-border)" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={dayLabel} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(l) => dayLabel(String(l))} formatter={(v, n) => [num(Number(v)), n]} cursor={{ stroke: 'var(--color-brand-border-strong)' }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#fill-${s.key})`} dot={false} activeDot={{ r: 4 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StackedBars({ data, series, height = 220, xKey = 'day' }: { data: Array<Record<string, string | number>>; series: readonly Series[]; height?: number; xKey?: string }) {
  return (
    <div style={{ height }} role="img" aria-label={`Daily ${series.map((s) => s.label).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-brand-border)" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={dayLabel} tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(l) => dayLabel(String(l))} formatter={(v, n) => [num(Number(v)), n]} cursor={{ fill: 'var(--color-brand-elevated)' }} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Legend({ series }: { series: readonly Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-brand-text-secondary)]">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

/** Horizontal bars for a ranked list — the right form for 5-12 categories with long labels. */
export function BarList({ items, color = CHART.one, format = num, empty = 'No data yet' }: { items: ReadonlyArray<{ label: string; value: number; hint?: string }>; color?: string; format?: (n: number) => string; empty?: string }) {
  if (items.length === 0) return <p className="py-4 text-sm text-[var(--color-brand-text-muted)]">{empty}</p>
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-[var(--color-brand-text-primary)]">{item.label}</span>
            <span className="shrink-0 font-mono-numbers tabular-nums text-[var(--color-brand-text-secondary)]">
              {format(item.value)}
              {item.hint ? <span className="ms-1.5 text-[var(--color-brand-text-muted)]">{item.hint}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]">
            <div className="h-full rounded-full" style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Cohort retention: rows are signup weeks, columns are weeks since signup. */
export function RetentionGrid({ cohorts }: { cohorts: ReadonlyArray<{ cohort_week: string; size: number; active: Record<string, number> }> }) {
  const weeks = cohorts.length
  const visible = cohorts.map((c, i) => ({ ...c, age: cohorts.length - 1 - i })).filter((c) => c.size > 0)
  if (visible.length === 0) return <p className="py-4 text-sm text-[var(--color-brand-text-muted)]">No signups in this window.</p>
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Retention cohorts">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr className="text-[var(--color-brand-text-muted)]">
            <th className="px-2 text-start font-medium">Cohort</th>
            <th className="px-2 text-end font-medium">Users</th>
            {Array.from({ length: weeks }, (_, i) => <th key={i} className="px-2 text-center font-medium">W{i}</th>)}
          </tr>
        </thead>
        <tbody>
          {visible.map((c) => {
            const age = c.age
            return (
              <tr key={c.cohort_week}>
                <td className="whitespace-nowrap px-2 text-[var(--color-brand-text-secondary)]">{dayLabel(c.cohort_week)}</td>
                <td className="px-2 text-end font-mono-numbers tabular-nums">{c.size}</td>
                {Array.from({ length: weeks }, (_, i) => {
                  if (i > age) return <td key={i} />
                  const share = (c.active[String(i)] ?? 0) / c.size
                  return (
                    <td key={i} className={cn('rounded-md px-2 py-1.5 text-center font-mono-numbers tabular-nums', share > 0.55 ? 'text-[var(--color-brand-on-primary)]' : 'text-[var(--color-brand-text-primary)]')} style={{ background: `color-mix(in oklab, var(--color-brand-primary) ${Math.round(share * 100)}%, var(--color-brand-elevated))` }}>
                      {Math.round(share * 100)}%
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
