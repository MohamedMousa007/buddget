import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OpenerStep } from './OpenerStep'
import { UnderstoodStep } from './UnderstoodStep'
import { ConflictStep } from './ConflictStep'
import { ScreenStep } from './ScreenStep'
import { QuestionControl } from './QuestionControl'
import { answer, createFlow } from '@/lib/budget/flow/flow'
import { NODE_BY_ID } from '@/lib/budget/flow/nodes'

describe('describe-yourself step', () => {
  const html = renderToStaticMarkup(h(OpenerStep, { base: 'EGP', onDone: vi.fn(), onSkip: vi.fn() }))

  it('asks for the details that prefill the most, and cannot be skipped', () => {
    expect(html).toContain('Tell me about yourself')
    expect(html).toContain('take-home pay')
    expect(html).not.toContain('Skip')
    expect(html).toContain('maxLength="1000"')
  })
  it('the continue button is disabled until something is written', () => {
    expect(html).toMatch(/disabled[^>]*>[^<]*Continue|Continue[^<]*<\/button>/)
  })
  it('shows what was understood, one row each', () => {
    const rows = [{ id: 'income', label: 'Income', value: 'EGP 18,000' }, { id: 'rent', label: 'Rent', value: 'EGP 6,000' }]
    const out = renderToStaticMarkup(h(UnderstoodStep, { rows, onEdit: vi.fn(), onContinue: vi.fn() }))
    expect(out).toContain('I picked up 2 things')
    expect(out).toContain('EGP 6,000')
  })
  it('every picked-up line is a button that opens its answer (BUD-106)', () => {
    const rows = [{ id: 'income', label: 'Income', value: 'EGP 18,000', note: 'Kept your records' }]
    const out = renderToStaticMarkup(h(UnderstoodStep, { rows, notes: ['Not used for now: Rent.'], onEdit: vi.fn(), onContinue: vi.fn() }))
    expect(out).toMatch(/<button[^>]*aria-label="Change: Income, EGP 18,000"/)
    expect(out).toContain('Kept your records')
    expect(out).toContain('Not used for now: Rent.')
  })
  it('a conflict is one radio group of the two values, plus an explicit keep', () => {
    const out = renderToStaticMarkup(h(ConflictStep, {
      index: 0, total: 2, title: 'Income: which is right?', app: { value: 'EGP 20,000', source: 'In Buddget' }, typed: { value: 'EGP 25,000', source: 'What you just wrote' },
      onPick: vi.fn(), onKeep: vi.fn(),
    }))
    expect(out).toContain('role="radiogroup"')
    expect(out.match(/role="radio"/g)).toHaveLength(2)
    expect(out).toContain('aria-checked="false"')
    expect(out).toContain('Keep my records for now')
    expect(out).toContain('1 of 2 to check')
    expect(out).not.toContain('Previous')
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
