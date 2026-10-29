import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebtCard } from './DebtCard'
import { FlowSummaryBand } from '@/components/features/flow/FlowSummaryBand'

vi.mock('@/components/ui/dialog/DialogProvider', () => ({ useConfirm: () => async () => true }))

const noop = () => {}
const render = (props: object) => renderToStaticMarkup(createElement(DebtCard, props as never))

describe('DebtCard kind mapping', () => {
  it('borrow shows the person row and direction label', () => {
    const html = render({
      kind: 'borrow', onEdit: noop, onPay: noop,
      vm: { id: 'd', dir: 'owe', total: 100, paid: 25, remaining: 75, currency: 'EGP', accent: '#123456', avatarInit: 'AB', name: 'Ali', person: 'Ali', relation: 'Friend', gold: null, goal: null },
    })
    expect(html).toContain('AB')
    expect(html).toContain('Friend')
    expect(html).toContain('75')
    expect(html).toContain('25%')
  })
  it('card shows masked last4 and three stat boxes', () => {
    const html = render({
      kind: 'card', onEdit: noop, onPay: noop, onCharges: noop,
      vm: { color: '#222', initials: 'HS', bank: 'HSBC', last4: '4242', outstanding: 500, currency: 'EGP', utilPct: 50, overBy: 0, limit: 1000, due: null, daysLeft: null, allDue: 600, installmentDue: 0, after: 100 },
    })
    expect(html).toContain('HSBC')
    expect(html).toContain('••4242')
    expect(html.match(/rounded-\[11px\]/g)?.length).toBe(3)
  })
  it('installment shows one segment per instalment', () => {
    const html = render({
      kind: 'installment', onEdit: noop, onPay: noop,
      vm: { brandColor: '#0a0', providerName: 'Valu', logoSlug: null, onCardLast4: null, item: 'Phone', count: 4, paid: 1, remaining: 300, currency: 'EGP', per: 100, next: null, method: null },
    })
    expect(html).toContain('Phone')
    expect(html.match(/h-2\.5 flex-1/g)?.length).toBe(4)
    expect(html).toContain('text-[32px]')
  })
})

describe('FlowSummaryBand through HeroBand', () => {
  it('keeps the band slots and direction chips', () => {
    const html = renderToStaticMarkup(createElement(FlowSummaryBand, {
      variant: 'budget', label: 'Left', big: '1,000', bar: { pct: 40 }, scale: ['a', 'b', 'c'],
      stats: [{ label: 'In', value: '1', dir: 'in' }, { label: 'Out', value: '2', dir: 'out' }, { label: 'Net', value: '3' }],
    }))
    expect(html).toContain('h-[34.5px]')
    expect(html).toContain('h-[66px]')
    expect(html).toContain('size-4')
    expect(html).toContain('1,000')
  })
})
