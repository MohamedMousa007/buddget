import { describe, expect, it } from 'vitest'
import { extractCounterparty, scoreSalaryEvidence } from './salaryEvidence'

const base = { amountDiff: 0, amount: 70000, paydayInWindow: true }

describe('scoreSalaryEvidence', () => {
  const cases: Array<[string, Parameters<typeof scoreSalaryEvidence>[0], boolean]> = [
    ['no context at all, exact amount on payday (legacy path)', { ...base }, true],
    ['EN salary credit from a company', { ...base, body: 'Your account ending 1234 has been credited with EGP 70,000.00 - Salary credit from ACME TECHNOLOGIES LLC. Available balance EGP 81,200.00' }, true],
    ['AR راتب wording', { ...base, body: 'تم إضافة مبلغ 70,000.00 جم إلى حسابك رقم 1234 - راتب شهر يوليو' }, true],
    ['IPN from the employer, no salary wording', { ...base, body: 'IPN: You received EGP 70,000.00 from ACME TECHNOLOGIES LLC via InstaPay. Ref 998877' }, true],
    ['IPN salary from an HR person with salary wording', { ...base, body: 'IPN received EGP 70,000.00 from Sara Ibrahim Nabil - salary July' }, true],
    ['IPN from a previously linked sender', { ...base, body: 'IPN: You received EGP 70,000.00 from ACME HR via InstaPay', knownCounterparties: ['ACME HR'] }, true],
    ['friend IPN, exact amount, payday', { ...base, body: 'IPN: You received EGP 70,000.00 from AHMED MOHAMED ALI via InstaPay on 20/07. Ref 123456' }, false],
    ['friend IPN within 2% (no wording)', { ...base, amountDiff: 0.01, amount: 69300, body: 'Transfer from Omar Hassan Fathy EGP 69,300.00 received via InstaPay' }, false],
    ['AR friend تحويل لحظي', { ...base, body: 'تم استلام تحويل لحظي بمبلغ 70,000 جم من محمد احمد علي' }, false],
    ['loan repayment wording', { ...base, body: 'Credited EGP 70,000.00 from Khaled Samir - loan repayment' }, false],
    ['AR سلف wording', { ...base, body: 'تم استلام 70,000 جم من خالد سمير - سداد سلف' }, false],
    ['gift from a person', { ...base, body: 'You received EGP 70,000.00 via InstaPay from Mona Adel Tarek - gift' }, false],
    ['salary wording but off-payday and 1.5% off', { amount: 71000, amountDiff: 0.014, paydayInWindow: false, body: 'Salary credit EGP 71,000' }, true],
    ['friend exact-sum transfer, no penalty and no independent signal', { ...base, body: 'Credited EGP 70,000.00 to your account ending 1234' }, false],
    ['IPN from an all-caps two-token employer', { ...base, body: 'IPN: You received EGP 70,000.00 from ACME EGYPT via InstaPay' }, true],
    ['IPN from a mixed-case person, same amount', { ...base, body: 'IPN: You received EGP 70,000.00 from Acme Egypt via InstaPay' }, false],
    ['person-shaped sender within 0.5% is not penalised but still needs a signal', { ...base, amountDiff: 0.001, body: 'Transfer from Omar Hassan Fathy EGP 70,000.00 via InstaPay' }, false],
    ['person penalty applies at 1% diff even with salary wording absent', { ...base, amountDiff: 0.01, body: 'Transfer from Omar Hassan Fathy via InstaPay' }, false],
    ['الدينار is not دين', { ...base, body: 'تم إضافة راتب 70,000 بالدينار المصري' }, true],
    ['power is not owe', { ...base, body: 'Salary credit from Power Grid Company EGP 70,000' }, true],
    ['أجرة is not أجر', { ...base, body: 'تم استلام تحويل لحظي بمبلغ 70,000 جم أجرة من محمد احمد علي' }, false],
    ['amount alone, off payday', { ...base, paydayInWindow: false }, false],
  ]
  it.each(cases)('%s', (_name, input, pass) => {
    expect(scoreSalaryEvidence(input).pass).toBe(pass)
  })

  it('does not read min inside a longer word as a from-phrase', () => {
    expect(extractCounterparty('حساب الأمن الغذائي 70,000')).toBeNull()
    expect(extractCounterparty('Power from ACME EGYPT.')).toBe('ACME EGYPT')
  })

  it('matches known counterparties on 2 shared tokens unless identical', () => {
    const run = (cp: string, known: string[]) =>
      scoreSalaryEvidence({ ...base, counterparty: cp, body: 'IPN received EGP 70,000 via InstaPay', knownCounterparties: known }).signals.some((x) => x.includes('seen on this salary'))
    expect(run('Ahmed', ['Ahmed Hassan'])).toBe(false)
    expect(run('Ahmed Hassan', ['Ahmed'])).toBe(false)
    expect(run('Ahmed Hassan Ali', ['Ahmed Hassan Samir'])).toBe(true)
    expect(run('Ahmed', ['Ahmed'])).toBe(true)
  })

  it('extracts the sender from a body', () => {
    expect(extractCounterparty('IPN: You received EGP 70,000.00 from AHMED MOHAMED ALI via InstaPay on 20/07')).toBe('AHMED MOHAMED ALI')
  })
})
