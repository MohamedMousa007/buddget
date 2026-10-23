import { describe, expect, it } from 'vitest'
import { triage } from './triage'

describe('triage', () => {
  it('trusts the chosen type and routes a clear bug to Linear', () => {
    const t = triage({ chosen: 'bug', title: 'Budget screen crashes', body: 'The app crashes when I open the budget plan after the update.' })
    expect(t).toMatchObject({ kind: 'bug', area: 'budget', severity: 'critical', state: 'auto_triaged', toLinear: true })
  })
  it('an idea is a low-severity feature request and never goes to Linear by itself', () => {
    const t = triage({ chosen: 'idea', title: 'Dark mode for charts', body: 'It would be great to have it.' })
    expect(t).toMatchObject({ kind: 'feature', severity: 'low', toLinear: false })
  })
  it('a question about billing or login becomes billing or account', () => {
    expect(triage({ chosen: 'question', title: 'Charged twice', body: 'I was charged twice for my subscription this month, please refund.' }).kind).toBe('billing')
    expect(triage({ chosen: 'question', title: 'Locked out', body: 'I cannot log in, password reset email never arrives.' }).kind).toBe('account')
  })
  it('a bug report stays a bug even when it mentions billing words', () => {
    expect(triage({ chosen: 'bug', title: 'Wrong invoice screen', body: 'The invoice screen shows an error when I open it from settings.' }).kind).toBe('bug')
  })
  it('vague, short reports go to a human instead of being routed on a guess', () => {
    const t = triage({ chosen: 'bug', title: 'Not good', body: 'broken' })
    expect(t).toMatchObject({ state: 'needs_human', toLinear: false })
    expect(t.confidence).toBeLessThan(0.7)
  })
  it('a serious bug still reaches engineering even when we are unsure of the area', () => {
    const t = triage({ chosen: 'bug', title: 'Please help', body: 'The app crashes on launch every time since yesterday and nothing helps me at all.' })
    expect(t.severity).toBe('critical')
    expect(t.toLinear).toBe(true)
  })
  it('reads Arabic reports too', () => {
    const t = triage({ chosen: 'question', title: 'مشكلة في تسجيل الدخول', body: 'لا أستطيع تسجيل الدخول منذ أمس' })
    expect(t.kind).toBe('account')
  })
})
