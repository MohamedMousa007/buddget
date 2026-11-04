import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractBalance, recordBalanceReport, resolveReportTarget } from './balanceReport'

describe('extractBalance', () => {
  it.each([
    ['From HSBC: 22JUL26 ELWAHAT FOR PETROLEM Purchase from 103-104***-001 EGP 715.00- Your available balance is EGP 3,571.53', 3571.53, 'EGP'],
    ['تم خصم EGP 12.75  من بطاقة الخصم المباشر # **6212 باستخدام Apple Pay عند  KAZYON في  07/07/26 17:16الرصيد المتاح  EGP3957.91.', 3957.91, 'EGP'],
    ['تم سحب 5900.00 جنية من محفظة فودافون كاش. رصيد حسابك الحالي 45.88 جنيه.', 45.88, undefined],
    ['You have a Trx on your Card no. XXXX2939 from Talabat for EGP  204.16 on 19-May at 05:06 your available balance is 276.10', 276.1, undefined],
    ['Avl Bal is AED 15,234.50', 15234.5, 'AED'],
    ['تم استلام مبلغ 6000 جنيه. رصيدك الحالي: 6004.88 جنيه', 6004.88, undefined],
    ['الرصيد المتاح ٢٧٠٠٫٠٣', 2700.03, undefined],
  ])('%#', (body, balance, currency) => {
    const r = extractBalance(body)
    if (balance == null) return expect(r).toBeNull()
    expect(r?.balance).toBe(balance)
    expect(r?.currency).toBe(currency)
  })
  it('never reads a credit-card limit or an amount as a balance', () => {
    expect(extractBalance('Avl Cr. Limit is AED 30,978.13')).toBeNull()
    expect(extractBalance('Rejected transaction: Insufficient balance\nCard: **6774\nAmount: 5.74 USD')).toBeNull()
    expect(extractBalance('Purchase EGP 715.00 at SHOP')).toBeNull()
  })
})

describe('resolveReportTarget', () => {
  const m = (o: object) => ({ id: 'x', name: 'x', type: 'bank_account', last4: null, currency: 'EGP', parent_id: null, track_sms: true, closed_at: null, ...o })
  const methods = [m({ id: 'bank', last4: '2016' }), m({ id: 'debit', type: 'debit_card', last4: '4417', parent_id: 'bank' }), m({ id: 'cc', type: 'credit_card', last4: '8821', parent_id: 'bank' })]
  it('maps an account last4 to itself and a debit card to its parent; credit cards report limits, so never', () => {
    expect(resolveReportTarget(methods, '2016')?.id).toBe('bank')
    expect(resolveReportTarget(methods, '4417')?.id).toBe('bank')
    expect(resolveReportTarget(methods, '8821')).toBeNull()
    expect(resolveReportTarget(methods, '9999')).toBeNull()
    expect(resolveReportTarget(methods, null)).toBeNull()
  })
  it('falls back to the sending provider only when it names exactly one account', () => {
    const wallets = [m({ id: 'vf', type: 'wallet', name: 'Vodafone Cash' }), m({ id: 'cib', type: 'bank_account', name: 'CIB ••2016', last4: '2016' })]
    expect(resolveReportTarget(wallets, null, { bankName: 'Vodafone Cash' })?.id).toBe('vf')
    expect(resolveReportTarget([...wallets, m({ id: 'vf2', type: 'wallet', name: 'Vodafone Cash' })], null, { bankName: 'Vodafone Cash' })).toBeNull()
    expect(resolveReportTarget(wallets, null, { bankName: 'Unknown Bank' })).toBeNull()
  })
})

describe('resolveReportTarget with short account tails and two accounts at one bank', () => {
  const m = (o: object) => ({ id: 'x', name: 'x', type: 'bank_account', last4: null, currency: 'EGP', parent_id: null, track_sms: true, closed_at: null, ...o })
  const hsbc = [
    m({ id: 'egp', name: 'HSBC Egypt ••0001', last4: '0001', currency: 'EGP' }),
    m({ id: 'usd', name: 'HSBC Egypt ••0110', last4: '0110', currency: 'USD' }),
    m({ id: 'card', name: 'HSBC Egypt', type: 'debit_card', parent_id: 'egp' }),
  ]
  it('reads "***-001" as the account saved as 0001', () => {
    expect(resolveReportTarget(hsbc, '001', { bankName: 'HSBC Egypt' })?.id).toBe('egp')
    expect(resolveReportTarget(hsbc, '110', { bankName: 'HSBC' })?.id).toBe('usd')
  })
  it('uses the stated currency to choose between two accounts of one bank when no number is usable', () => {
    expect(resolveReportTarget(hsbc, null, { bankName: 'HSBC Egypt' }, 'EGP')?.id).toBe('egp')
    expect(resolveReportTarget(hsbc, null, { bankName: 'HSBC Egypt' }, 'USD')?.id).toBe('usd')
    expect(resolveReportTarget(hsbc, null, { bankName: 'HSBC Egypt' }, 'LE')?.id).toBe('egp')
    expect(resolveReportTarget(hsbc, null, { bankName: 'HSBC Egypt' }, null)).toBeNull()
  })
  it('picks nothing when a tail fits two accounts, even if the provider would name one', () => {
    const clash = [m({ id: 'a', name: 'HSBC Egypt ••0001', last4: '0001' }), m({ id: 'b', name: 'HSBC Egypt ••1001', last4: '1001' })]
    expect(resolveReportTarget(clash, '001', { bankName: 'HSBC Egypt' }, 'EGP')).toBeNull()
  })
  it('ignores closed accounts', () => {
    expect(resolveReportTarget([m({ id: 'old', last4: '0001', closed_at: '2026-01-01' })], '001')).toBeNull()
  })
})

describe('recordBalanceReport', () => {
  type Call = { table: string; op: string; payload?: unknown }
  function service(opts: { existing?: { id: string } | null; failWrite?: boolean }) {
    const calls: Call[] = []
    const methods = [{ id: 'egp', name: 'HSBC Egypt ••0001', type: 'bank_account', last4: '0001', currency: 'EGP', parent_id: null, track_sms: true, closed_at: null }]
    const from = (table: string) => {
      const q: Record<string, unknown> = {}
      const done = (op: string, payload?: unknown) => { calls.push({ table, op, payload }); return q }
      q.select = () => done('select')
      q.eq = () => q
      q.is = () => q
      q.maybeSingle = async () => ({ data: opts.existing ?? null, error: null })
      q.insert = async (p: unknown) => { calls.push({ table, op: 'insert', payload: p }); return { error: opts.failWrite ? new Error('boom') : null } }
      q.update = (p: unknown) => { calls.push({ table, op: 'update', payload: p }); return { eq: async () => ({ error: opts.failWrite ? new Error('boom') : null }) } }
      q.then = (r: (v: unknown) => unknown) => r({ data: table === 'payment_methods' ? methods : null, error: null })
      return q
    }
    return { svc: { from } as unknown as SupabaseClient, calls }
  }
  const input = (svc: SupabaseClient) => ({ service: svc, userId: 'u', logId: 'l1', body: 'Purchase from 103-104***-001 EGP 485.00- Your available balance is EGP 2,785.17', amount: 485, last4: '001', receivedAt: '2026-10-31T13:44:30Z', bankName: 'HSBC Egypt' })

  it('inserts a report without an onConflict upsert and stamps the log', async () => {
    const { svc, calls } = service({ existing: null })
    await recordBalanceReport(input(svc))
    const insert = calls.find((c) => c.table === 'account_balance_reports' && c.op === 'insert')
    expect(insert?.payload).toMatchObject({ payment_method_id: 'egp', balance: 2785.17, currency: 'EGP', sms_parse_log_id: 'l1' })
    expect(calls.find((c) => c.table === 'sms_parse_log' && c.op === 'update')?.payload).toMatchObject({ payment_method_id: 'egp', balance_after: 2785.17 })
  })
  it('updates in place when the message was already reported', async () => {
    const { svc, calls } = service({ existing: { id: 'r1' } })
    await recordBalanceReport(input(svc))
    expect(calls.some((c) => c.table === 'account_balance_reports' && c.op === 'insert')).toBe(false)
    expect(calls.some((c) => c.table === 'account_balance_reports' && c.op === 'update')).toBe(true)
  })
  it('does not stamp the log when the report could not be saved, and never throws', async () => {
    const { svc, calls } = service({ existing: null, failWrite: true })
    await expect(recordBalanceReport(input(svc))).resolves.toBeUndefined()
    expect(calls.some((c) => c.table === 'sms_parse_log' && c.op === 'update')).toBe(false)
  })
  it('skips a message whose balance equals its amount', async () => {
    const { svc, calls } = service({})
    await recordBalanceReport({ ...input(svc), amount: 2785.17 })
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })
})
