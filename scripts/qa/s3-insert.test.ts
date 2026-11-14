/**
 * S3b: books the repair inserts (T7b own net-zero rows, T6 lost rows, the transfer-from-cash rows of T4, the net-zero rows of T8)
 * through the real booking function `createSmsTransaction`, from the stored log columns, as the dry run replayed them.
 * Not a test: a one-off script that vitest runs because it resolves the `@/` imports. It does nothing unless S3_INSERT=1.
 *
 *   S3_INSERT=1 S3_BATCH=s3-20261115 S3_TYPES=T7b [S3_ONLY=0fe8887c,4a7d7250] [S3_DRY=1] \
 *     TZ=Africa/Cairo npx vitest run -c scripts/qa/s3-vitest.config.ts scripts/qa/s3-insert.test.ts
 *
 * No push and no "new transaction" toast: those are sent by the parse route AFTER createSmsTransaction returns (nudgeUser, sendNativePush,
 * emitNotification, sms_mark_pushed, the AI categorisation in after()). createSmsTransaction itself sends nothing, and this script
 * calls only it and appendSmsFlags, so nothing is sent for an old row.
 *
 * Per message: the live log must have no live money row (the retraction of T4 and T8 ran first), the booked row must equal the report's
 * proposed row, and no other row of the user may change. Each insert is audited (sms_s3_record_insert) BEFORE it is checked, so a failed
 * check stops the run with the row already in the audit table and `select sms_s3_revert('<batch>')` removes it.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createSmsTransaction } from '@/lib/sms/dispatch'
import { appendSmsFlags } from '@/lib/sms/stampFlags'
import { DEFAULT_MARKET_RATES } from '@/lib/store/defaultFinanceData'
import type { SmsFlag } from '@/lib/sms/smsFlags'
import type { SmsRowData } from '@/lib/sms/createSmsExpense'

const ROOT = path.resolve(__dirname, '../..')
const ENABLED = process.env.S3_INSERT === '1'

interface Proposed { t: 'E' | 'I'; cls: string; cat: string; amt: number; ccy: string; day: string; refund: [string | null, string | null]; flags: string[] }
interface Item { prefix: string; usr: string; rtype: string; step: number; ins: Proposed | null }

const NON_SPEND = ['Transfer', 'CC Payoff', 'ATM Cash Withdrawal', 'Installment', 'Currency Exchange']

function loadEnv() {
  for (const f of [path.join(ROOT, '.env.local'), path.join(ROOT, '../../../.env.local')]) {
    try { process.loadEnvFile(f); return } catch { /* try the next */ }
  }
}

const classOf = (t: 'E' | 'I', row: Record<string, unknown>): string => {
  if (t === 'I') return 'income'
  if (row.refunded_at) return 'netzero'
  return NON_SPEND.includes(String(row.category)) ? 'nonspend' : 'spend'
}

describe.skipIf(!ENABLED)('S3b insert script', () => {
  it('books the inserts of the chosen repair types', async () => {
    loadEnv()
    const batch = process.env.S3_BATCH
    if (!batch) throw new Error('S3_BATCH is required')
    const types = (process.env.S3_TYPES ?? '').split(',').filter(Boolean)
    const only = (process.env.S3_ONLY ?? '').split(',').filter(Boolean)
    const dry = process.env.S3_DRY === '1'
    const items = (JSON.parse(readFileSync(path.join(ROOT, 'scripts/qa/s3-apply-input.json'), 'utf8')).rows as Item[])
      .filter((r) => r.ins && types.includes(r.rtype) && (only.length === 0 || only.includes(r.prefix)))
    expect(items.length).toBeGreaterThan(0)
    const svc = createServiceRoleClient()
    const report: string[] = []

    for (const it of items) {
      // an 8-character id prefix is a uuid range
      const { data: logs, error: logErr } = await svc.from('sms_parse_log').select('*')
        .gte('id', `${it.prefix}-0000-0000-0000-000000000000`).lte('id', `${it.prefix}-ffff-ffff-ffff-ffffffffffff`)
      const log = logs?.find((l) => l.user_id.startsWith(it.usr))
      if (!log) throw new Error(`${it.prefix}: log not found (${logErr?.message ?? 'no row'})`)
      const p = it.ins as Proposed
      const body = (log.masked_body ?? log.raw_body) as string | null
      if (!body || log.amount == null || !log.kind || !log.currency) throw new Error(`${it.prefix}: log has no body, kind or amount`)

      const [{ data: liveE }, { data: liveI }] = await Promise.all([
        svc.from('expenses').select('id').eq('sms_log_id', log.id).is('deleted_at', null),
        svc.from('income_events').select('id').eq('sms_log_id', log.id).is('deleted_at', null),
      ])
      if ((liveE?.length ?? 0) + (liveI?.length ?? 0) > 0) throw new Error(`${it.prefix}: the message already owns a live money row`)

      const row: SmsRowData = {
        userId: log.user_id, amount: Number(log.amount), currency: log.currency, day: p.day, kind: log.kind as SmsRowData['kind'], cleanTitle: log.clean_title,
        merchantNormalized: log.merchant_normalized, merchant: log.merchant, bankName: log.bank_name, categoryHint: log.category, source: 'sms', rawBody: body,
        sender: log.sender, last4: log.account_last4, counterpartyLast4: log.counterparty_last4, receivedAtIso: log.received_at, logId: log.id,
        matchedTemplateId: log.matched_template_id, counterpartyIsSelf: log.counterparty_is_self, deviceId: log.device_id,
        counterpartyHash: log.counterparty_hash, referenceHash: log.reference_hash,
        kindSource: log.kind === 'own_transfer' ? 'code' : log.parse_method !== 'fully_curated' ? 'model' : 'code',
        smsFlags: p.flags.includes('possible_duplicate') ? (['possible_duplicate'] as SmsFlag[]) : undefined,
      }
      if (dry) { report.push(`${it.prefix} ${it.rtype} DRY ok: would book ${p.cls} ${p.cat} ${p.amt} ${p.ccy} ${p.day}`); continue }

      const t0 = new Date().toISOString()
      const tx = await createSmsTransaction(svc, row, { exchangeRates: DEFAULT_MARKET_RATES })
      if (tx.error) throw new Error(`${it.prefix}: booking failed: ${tx.error.message}`)
      const table = tx.expenseId ? 'expenses' : tx.incomeId ? 'income_events' : null
      const rowId = tx.expenseId ?? tx.incomeId
      if (!table || !rowId) throw new Error(`${it.prefix}: the booking function posted no row (outcome ${tx.outcome})`)
      if (p.flags.length) await appendSmsFlags(svc, log.user_id, log.id, p.flags as SmsFlag[])

      const rec = await svc.rpc('sms_s3_record_insert', { p_batch: batch, p_repair_type: it.rtype, p_log_id: log.id, p_table: table, p_row_id: rowId })
      if (rec.error) throw new Error(`${it.prefix}: audit failed: ${rec.error.message} (row ${rowId.slice(0, 8)} exists, revert the batch)`)

      // the booked row must be the proposed one, and nothing else of the user may have moved
      const { data: booked } = await svc.from(table).select('*').eq('id', rowId).single()
      const b = booked as Record<string, unknown>
      const got = `${table === 'expenses' ? 'E' : 'I'} ${classOf(table === 'expenses' ? 'E' : 'I', b)} ${Number(b.amount)} ${b.currency} ${String(b.expense_date ?? b.received_date)}`
      const want = `${p.t} ${p.cls} ${p.amt} ${p.ccy} ${p.day}`
      const flags = new Set<string>((b.sms_flags as string[] | null) ?? [])
      const missing = p.flags.filter((f) => !flags.has(f))
      const others: string[] = []
      for (const t of ['expenses', 'income_events', 'debt_payments', 'payment_methods', 'debts'] as const) {
        const { data } = await svc.from(t).select('id').eq('user_id', log.user_id).gt('updated_at', t0)
        for (const o of data ?? []) if (o.id !== rowId) others.push(`${t}:${o.id.slice(0, 8)}`)
      }
      if (got !== want || missing.length || others.length) {
        throw new Error(`${it.prefix}: booked "${got}" wanted "${want}", missing flags [${missing}], other rows touched [${others}] (row ${rowId.slice(0, 8)} is audited; revert the batch)`)
      }
      report.push(`${it.prefix} ${it.rtype} booked ${table} ${rowId.slice(0, 8)} ${got}`)
    }
    console.log(report.join('\n'))
  }, 300_000)
})
