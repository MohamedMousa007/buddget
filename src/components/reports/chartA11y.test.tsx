import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DOMParser } from '@xmldom/xmldom'

vi.mock('recharts', () => {
  const Stub = () => null
  return { BarChart: Stub, Bar: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, ResponsiveContainer: Stub, Legend: Stub, PieChart: Stub, Pie: Stub, Cell: Stub }
})

import { MonthlyChart } from './MonthlyChart'
import { CategoryPieChart } from './CategoryPieChart'
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'

const dom = (html: string) => new DOMParser().parseFromString(`<root>${html}</root>`, 'text/xml')

describe('A11-14 report charts have a name and a data table', () => {
  it('monthly chart: role=img with a summary, plus a table of every month', () => {
    const doc = dom(renderToStaticMarkup(h(MonthlyChart, { currency: 'EGP', data: [{ month: 'Oct', income: 100, expenses: 40, savings: 10 }, { month: 'Nov', income: 90, expenses: 50, savings: 0 }] })))
    const img = Array.from(doc.getElementsByTagName('div')).find((d) => d.getAttribute('role') === 'img')!
    expect(img.getAttribute('aria-label')).toBe(en.reports.chart.monthSummary(2))
    expect(doc.getElementsByTagName('tbody')[0].getElementsByTagName('tr').length).toBe(2)
    expect(doc.getElementsByTagName('th').length).toBeGreaterThanOrEqual(4)
  })
  it('pie chart: role=img naming the largest slice, plus a table row per slice', () => {
    const doc = dom(renderToStaticMarkup(h(CategoryPieChart, { currency: 'EGP', data: [{ name: 'Food', value: 300 }, { name: 'Rent', value: 200 }] })))
    const img = Array.from(doc.getElementsByTagName('div')).find((d) => d.getAttribute('role') === 'img')!
    expect(img.getAttribute('aria-label')).toBe(en.reports.chart.pieSummary(2, 'Food'))
    expect(doc.getElementsByTagName('tbody')[0].getElementsByTagName('tr').length).toBe(2)
  })
  it('Arabic summaries exist and carry the numbers', () => {
    expect(ar.reports.chart.monthSummary(3)).toContain('3')
    expect(ar.reports.chart.pieSummary(4, 'x')).toContain('4')
  })
})
