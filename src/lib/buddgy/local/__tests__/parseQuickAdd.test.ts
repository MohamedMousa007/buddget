import { describe, expect, it } from 'vitest'
import { parseQuickAdd, type QuickAddInput } from '../parseQuickAdd'

// 2026-10-19 is a Monday
const input: QuickAddInput = {
  baseCurrency: 'EGP',
  knownCurrencies: ['EGP', 'USD', 'AED', 'SAR'],
  paymentMethodNames: [
    { ref: 'pm_cib', name: 'CIB' },
    { ref: 'pm_cash', name: 'Cash' },
    { ref: 'pm_cibc', name: 'CIB Credit' },
    { ref: 'pm_vf', name: 'فودافون كاش' },
  ],
  today: '2026-10-19',
  locale: 'en',
}

const run = (text: string, over: Partial<QuickAddInput> = {}) => parseQuickAdd(text, { ...input, ...over })

type Expected = { tool: 'add_expense' | 'add_income'; args: Record<string, unknown> }

describe('parseQuickAdd accepts', () => {
  const cases: [string, Expected][] = [
    ['coffee 45', { tool: 'add_expense', args: { description: 'coffee', amount: 45, category: 'Food' } }],
    ['قهوة ٤٥', { tool: 'add_expense', args: { description: 'قهوة', amount: 45, category: 'Food' } }],
    ['قهوه ۴۵', { tool: 'add_expense', args: { description: 'قهوه', amount: 45, category: 'Food' } }],
    ['spent 200 on groceries at cib', { tool: 'add_expense', args: { description: 'groceries at cib', amount: 200, category: 'Groceries' } }],
    ['lunch 120 egp', { tool: 'add_expense', args: { description: 'lunch', amount: 120, currency: 'EGP', category: 'Food' } }],
    ['غدا 120 جنيه', { tool: 'add_expense', args: { description: 'غدا', amount: 120, currency: 'EGP', category: 'Food' } }],
    ['غدا ١٢٠ ج', { tool: 'add_expense', args: { description: 'غدا', amount: 120, currency: 'EGP', category: 'Food' } }],
    ['uber 85.5', { tool: 'add_expense', args: { description: 'uber', amount: 85.5, category: 'Transport' } }],
    ['uber 85,5', { tool: 'add_expense', args: { description: 'uber', amount: 85.5, category: 'Transport' } }],
    ['uber ٨٥٫٥', { tool: 'add_expense', args: { description: 'uber', amount: 85.5, category: 'Transport' } }],
    ['rent 1,200', { tool: 'add_expense', args: { description: 'rent', amount: 1200, category: 'Rent' } }],
    ['rent ١٬٢٠٠', { tool: 'add_expense', args: { description: 'rent', amount: 1200, category: 'Rent' } }],
    ['rent 12k', { tool: 'add_expense', args: { description: 'rent', amount: 12000, category: 'Rent' } }],
    ['rent 1.5K', { tool: 'add_expense', args: { description: 'rent', amount: 1500, category: 'Rent' } }],
    ['ايجار ٣ ألف', { tool: 'add_expense', args: { description: 'ايجار', amount: 3000, category: 'Rent' } }],
    ['إيجار 3 الف جنيه', { tool: 'add_expense', args: { description: 'إيجار', amount: 3000, currency: 'EGP', category: 'Rent' } }],
    ['rent 1.2 million', { tool: 'add_expense', args: { description: 'rent', amount: 1200000, category: 'Rent' } }],
    ['rent 2m', { tool: 'add_expense', args: { description: 'rent', amount: 2000000, category: 'Rent' } }],
    ['netflix $15', { tool: 'add_expense', args: { description: 'netflix', amount: 15, currency: 'USD', category: 'Subscription' } }],
    ['netflix 15 dollars', { tool: 'add_expense', args: { description: 'netflix', amount: 15, currency: 'USD', category: 'Subscription' } }],
    ['netflix 15 دولار', { tool: 'add_expense', args: { description: 'netflix', amount: 15, currency: 'USD', category: 'Subscription' } }],
    ['taxi 30 aed', { tool: 'add_expense', args: { description: 'taxi', amount: 30, currency: 'AED', category: 'Transport' } }],
    ['تاكسي 30 درهم', { tool: 'add_expense', args: { description: 'تاكسي', amount: 30, currency: 'AED', category: 'Transport' } }],
    ['بنزين 300 ريال', { tool: 'add_expense', args: { description: 'بنزين', amount: 300, currency: 'SAR', category: 'Fuel' } }],
    ['petrol 400', { tool: 'add_expense', args: { description: 'petrol', amount: 400, category: 'Fuel' } }],
    ['electricity bill 650', { tool: 'add_expense', args: { description: 'electricity bill', amount: 650, category: 'Utilities' } }],
    ['فاتورة كهرباء 650', { tool: 'add_expense', args: { description: 'فاتورة كهرباء', amount: 650, category: 'Utilities' } }],
    ['pharmacy 90', { tool: 'add_expense', args: { description: 'pharmacy', amount: 90, category: 'Health' } }],
    ['دكتور 500', { tool: 'add_expense', args: { description: 'دكتور', amount: 500, category: 'Health' } }],
    ['cinema 150', { tool: 'add_expense', args: { description: 'cinema', amount: 150, category: 'Enjoyment' } }],
    ['سينما 150', { tool: 'add_expense', args: { description: 'سينما', amount: 150, category: 'Enjoyment' } }],
    ['shoes from noon 900', { tool: 'add_expense', args: { description: 'shoes from noon', amount: 900, category: 'Shopping' } }],
    ['course 2500', { tool: 'add_expense', args: { description: 'course', amount: 2500, category: 'Education' } }],
    ['سوبر ماركت 340', { tool: 'add_expense', args: { description: 'سوبر ماركت', amount: 340, category: 'Groceries' } }],
    ['بقالة 60', { tool: 'add_expense', args: { description: 'بقالة', amount: 60, category: 'Groceries' } }],
    ['coffee 45 yesterday', { tool: 'add_expense', args: { description: 'coffee', amount: 45, category: 'Food', date: '2026-10-18' } }],
    ['coffee 45 today', { tool: 'add_expense', args: { description: 'coffee', amount: 45, category: 'Food', date: '2026-10-19' } }],
    ['قهوة 45 امبارح', { tool: 'add_expense', args: { description: 'قهوة', amount: 45, category: 'Food', date: '2026-10-18' } }],
    ['قهوة 45 اول امبارح', { tool: 'add_expense', args: { description: 'قهوة', amount: 45, category: 'Food', date: '2026-10-17' } }],
    ['قهوة 45 النهاردة', { tool: 'add_expense', args: { description: 'قهوة', amount: 45, category: 'Food', date: '2026-10-19' } }],
    ['قهوة 45 اليوم', { tool: 'add_expense', args: { description: 'قهوة', amount: 45, category: 'Food', date: '2026-10-19' } }],
    ['قهوة 45 أمس', { tool: 'add_expense', args: { description: 'قهوة', amount: 45, category: 'Food', date: '2026-10-18' } }],
    ['dinner 300 on friday', { tool: 'add_expense', args: { description: 'dinner', amount: 300, category: 'Food', date: '2026-10-16' } }],
    ['dinner 300 monday', { tool: 'add_expense', args: { description: 'dinner', amount: 300, category: 'Food', date: '2026-10-12' } }],
    ['dinner 300 يوم الخميس', { tool: 'add_expense', args: { description: 'dinner', amount: 300, category: 'Food', date: '2026-10-15' } }],
    ['dinner 300 2026-10-01', { tool: 'add_expense', args: { description: 'dinner', amount: 300, category: 'Food', date: '2026-10-01' } }],
    ['dinner 300 on 5/10', { tool: 'add_expense', args: { description: 'dinner', amount: 300, category: 'Food', date: '2026-10-05' } }],
    ['dinner 300 25/12', { tool: 'add_expense', args: { description: 'dinner', amount: 300, category: 'Food', date: '2025-12-25' } }],
    ['lunch 120 with cib', { tool: 'add_expense', args: { description: 'lunch', amount: 120, category: 'Food', method: 'pm_cib' } }],
    ['lunch 120 using Cash', { tool: 'add_expense', args: { description: 'lunch', amount: 120, category: 'Food', method: 'pm_cash' } }],
    ['lunch 120 by CIB Credit', { tool: 'add_expense', args: { description: 'lunch', amount: 120, category: 'Food', method: 'pm_cibc' } }],
    ['غدا 120 بفودافون كاش', { tool: 'add_expense', args: { description: 'غدا', amount: 120, category: 'Food', method: 'pm_vf' } }],
    ['غدا 120 عن طريق فودافون كاش', { tool: 'add_expense', args: { description: 'غدا', amount: 120, category: 'Food', method: 'pm_vf' } }],
    ['paid 50 to ahmed', { tool: 'add_expense', args: { description: 'ahmed', amount: 50, category: 'Other' } }],
    ['salary 15k today', { tool: 'add_income', args: { name: 'salary', amount: 15000, date: '2026-10-19', frequency: 'one_time' } }],
    ['راتب ١٥ ألف', { tool: 'add_income', args: { name: 'راتب', amount: 15000, frequency: 'one_time' } }],
    ['received 500 from ahmed', { tool: 'add_income', args: { name: 'ahmed', amount: 500, frequency: 'one_time' } }],
    ['قبضت 2000 جنيه مكافأة', { tool: 'add_income', args: { name: 'مكافأة', amount: 2000, currency: 'EGP', frequency: 'one_time' } }],
    ['bonus 3000 usd', { tool: 'add_income', args: { name: 'bonus', amount: 3000, currency: 'USD', frequency: 'one_time' } }],
  ]

  it.each(cases)('%s', (text, expected) => {
    const out = run(text)
    expect(out).not.toBeNull()
    expect(out?.tool).toBe(expected.tool)
    expect(out?.args).toEqual(expected.args)
    expect(out?.description).toBe(out?.tool === 'add_income' ? out.args.name : out?.args.description)
  })
})

describe('parseQuickAdd confidence', () => {
  it('is high when a keyword fixes the category', () => {
    expect(run('coffee 45')?.confidence).toBeGreaterThanOrEqual(0.85)
    expect(run('salary 15k')?.confidence).toBeGreaterThanOrEqual(0.85)
  })
  it('is low when the category is a guess', () => {
    expect(run('paid 50 to ahmed')?.confidence).toBeLessThan(0.85)
    expect(run('xyz 50')?.args.category).toBe('Other')
  })
  it('is low when keywords conflict', () => {
    const out = run('uber restaurant 90')
    expect(out?.args.category).toBe('Other')
    expect(out?.confidence).toBeLessThan(0.85)
  })
  it('is low for income without a noun cue', () => {
    expect(run('got 500 from ahmed')?.confidence).toBeLessThan(0.85)
  })
})

describe('parseQuickAdd method safety', () => {
  it('ignores a method name without a cue word', () => {
    expect(run('lunch 120 cash')?.args.method).toBeUndefined()
  })
  it('ignores an ambiguous method', () => {
    const out = run('lunch 120 with cib', {
      paymentMethodNames: [
        { ref: 'a', name: 'CIB' },
        { ref: 'b', name: 'cib' },
      ],
    })
    expect(out?.args.method).toBeUndefined()
  })
})

describe('parseQuickAdd rejects', () => {
  const nulls: string[] = [
    '',
    '   ',
    'coffee',
    'coffee 0',
    'coffee 0.00',
    '45',
    '45 egp',
    'spent 200',
    'coffee 45 and lunch 120',
    'coffee 45, lunch 120',
    'قهوة 45 وغدا 120',
    'room 12 floor 3 pay 500',
    'buy 2 coffee 45',
    'coffee x2 45',
    'how much is coffee 45',
    'coffee 45?',
    'قهوة ٤٥؟',
    'what did I spend on coffee 45',
    'when did I pay rent 5000',
    'كم صرفت على قهوة 45',
    'ايه ده قهوة 45',
    'delete coffee 45',
    'remove the coffee 45',
    'change coffee to 50',
    'update lunch 120',
    'edit lunch 120',
    'cancel netflix 15',
    'احذف قهوة 45',
    'غير قهوة 45',
    'عدل غدا 120',
    'الغي اشتراك 15',
    'I bought a very long list of things for the whole family today 500',
    'coffee 5 gbp',
    'coffee 5 egp usd',
    'coffee 5 dinar kwd',
    'coffee 1.200',
    'coffee 1,23,4',
    'coffee 10:30 45',
    'coffee 45 yesterday today',
    'coffee 45 32/13',
    'coffee 45 2026-02-30',
    'coffee 45 2027-01-01',
    'got coffee 45',
    'salary spent 500',
  ]
  it.each(nulls)('%j', (text) => {
    expect(run(text)).toBeNull()
  })

  it('resolves pounds only when unambiguous', () => {
    expect(run('lunch 12 pounds', { knownCurrencies: ['EGP', 'USD'] })?.args.currency).toBe('EGP')
    expect(run('lunch 12 pounds', { knownCurrencies: ['GBP', 'USD'] })?.args.currency).toBe('GBP')
    expect(run('lunch 12 pounds', { knownCurrencies: ['GBP', 'EGP'] })).toBeNull()
  })
})
