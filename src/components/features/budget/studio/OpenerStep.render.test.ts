import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OpenerStep } from './OpenerStep'
import { UnderstoodStep } from './UnderstoodStep'
import { ScreenStep } from './ScreenStep'
import { QuestionControl } from './QuestionControl'
import { answer, createFlow } from '@/lib/budget/flow/flow'
import { NODE_BY_ID } from '@/lib/budget/flow/nodes'

describe('describe-yourself step', () => {
  const html = renderToStaticMarkup(h(OpenerStep, { base: 'EGP', onDone: vi.fn() }))

  it('asks for the details that prefill the most, and cannot be skipped', () => {
    expect(html).toContain('Tell me about yourself')
    expect(html).toContain('take-home pay')
    expect(html).not.toContain('Skip')
    expect(html).toContain('maxLength="400"')
  })
  it('the continue button is disabled until something is written', () => {
    expect(html).toMatch(/disabled[^>]*>[^<]*Continue|Continue[^<]*<\/button>/)
  })
  it('shows what was understood, one row each', () => {
    const rows = [{ id: 'income', label: 'Income', value: 'EGP 18,000' }, { id: 'rent', label: 'Rent', value: 'EGP 6,000' }]
    const out = renderToStaticMarkup(h(UnderstoodStep, { rows, onContinue: vi.fn() }))
    expect(out).toContain('I picked up 2 things')
    expect(out).toContain('EGP 6,000')
  })

  const screen = (s: ReturnType<typeof createFlow>, id: string) =>
    renderToStaticMarkup(h(ScreenStep, { state: s, head: NODE_BY_ID.get(id)!, reopen: false, base: 'EGP', saved: false, fill: () => '3', onSubmit: vi.fn() }))

  it('shows tracked income, bills, debts and goals as one "found" card each, with a right / not right choice', () => {
    const out = screen(createFlow('save', { income: 18000, knownBillCount: 3, knownDebtCount: 2, knownGoalCount: 1 }), 'confirmIncome')
    expect(out).toContain('Here is what I found')
    expect(out.match(/Not right/g)?.length).toBe(4)
  })
  it('a debt screen cannot continue until a kind is chosen', () => {
    const s = answer(answer(createFlow('debt'), 'hasDebts', true), 'x', true)
    expect(screen(s, 'debtKinds')).toMatch(/disabled[^>]*>[^<]*Continue|Continue[^<]*<\/button>/)
  })
})

describe('choices announce which one is chosen', () => {
  const copy = { label: 'How do you earn it?', why: '', opts: { salary: 'Salary', freelance: 'Freelance', business: 'Business', seasonal: 'Seasonal', mixed: 'Mixed', benefits: 'Benefits', allowance: 'Allowance' } }
  const ui = {} as never
  const render = (value: string) => renderToStaticMarkup(h(QuestionControl, { node: NODE_BY_ID.get('incomeType')!, copy, ui, base: 'EGP', value, onChange: vi.fn() }))

  it('a long list of chips says which chip is pressed, inside a plain group', () => {
    const out = render('freelance')
    expect(out).toContain('role="group"')
    expect(out).not.toContain('role="radiogroup"')
    expect(out.match(/aria-pressed="true"/g)?.length).toBe(1)
    expect(out.match(/aria-pressed="false"/g)?.length).toBe(6)
  })
})
