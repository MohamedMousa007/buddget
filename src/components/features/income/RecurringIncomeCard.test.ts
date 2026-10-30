import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecurringIncomeCard } from './RecurringIncomeCard'
import type { IncomeOccurrence, IncomeOccurrenceStatus } from '@/lib/utils/incomeOccurrences'

const occ = (status: IncomeOccurrenceStatus, eventId?: string): IncomeOccurrence => ({
  key: `s@2026-10-05-${status}`,
  date: '2026-10-05',
  dueDate: '2026-10-05',
  status,
  amount: 1000,
  currency: 'EGP',
  eventId,
  actionable: true,
})

const render = (occurrences: IncomeOccurrence[], extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    h(RecurringIncomeCard, {
      name: 'Salary',
      cadenceLine: 'Monthly · 5',
      expectedBig: '1,000',
      expectedCurrency: 'EGP',
      expectedTag: 'Expected / mo',
      progressPct: 40,
      progressLine: '400 of 1,000',
      occurrences,
      dateLabel: (o: IncomeOccurrence) => `D-${o.status}`,
      footer: h('button', null, 'FOOT'),
      ...extra,
    }),
  )

describe('RecurringIncomeCard through HeroBand', () => {
  it.each<[IncomeOccurrenceStatus, string | undefined]>([
    ['awaiting', undefined],
    ['received', 'e1'],
    ['partial', 'e2'],
    ['late', undefined],
  ])('renders the %s payday with the band slots', (status, eventId) => {
    const html = render([occ(status, eventId)])
    expect(html).toContain('rounded-3xl')
    expect(html).toContain('Salary')
    expect(html).toContain('1,000')
    expect(html).toContain('Monthly · 5')
    expect(html).toContain('400 of 1,000')
    expect(html).toContain('Expected / mo')
    expect(html).toContain(`aria-label="D-${status}"`)
    expect(html).toContain('FOOT')
    expect(html).not.toContain('#0f0f15')
  })
  it('renders the bar and no payday dots when there are none', () => {
    const html = render([])
    expect(html).toContain('width:40%')
    expect(html).not.toContain('aria-pressed')
  })
  it('shows the tick in select mode and an accessible menu trigger in edit mode', () => {
    expect(render([occ('awaiting')], { showTick: true })).toContain('bg-[var(--color-brand-green)] text-[var(--color-brand-on-primary)]')
    expect(render([occ('awaiting')], { onEdit: () => {}, editAriaLabel: 'Salary actions' })).toContain('aria-label="Salary actions"')
  })
})
