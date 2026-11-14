/**
 * S3 dry run: dumps what today's booking code does with every stored message, per message, to .claude/s3-replay-dump.json
 * (git-ignored: it holds account ids). Read only: replays in memory, never touches a database.
 *
 *   TZ=Africa/Cairo npx vitest run -c scripts/qa/s3-vitest.config.ts
 *
 * Needs .claude/sms-s2c-replay.json (scripts/qa/sms-s2c-replay-inputs.sql). The analysis half is scripts/qa/s3-dryrun-report.py.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'
import { isCashDeposit } from '@/lib/sms/cashDeposit'
import { effectiveSender } from '@/lib/sms/routingKey'
import { coarseShapeKey } from '@/lib/sms/skeleton'
import { isCollectedNotice } from '@/lib/sms/collectedNotice'
import { ownExpenses, ownIncomes, readLogs, replay, replayClass, type ReplayExport, type ReplayRun, type Row } from '@/lib/sms/gold/closingReplay'

const ROOT = path.resolve(__dirname, '../..')
const EXPORT = process.env.SMS_S2C_REPLAY ?? path.join(ROOT, '.claude/sms-s2c-replay.json')
const OUT = path.join(ROOT, '.claude/s3-replay-dump.json')

const pick = (r: Row, keys: string[]): Row => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]))
const EXP_KEYS = ['category', 'amount', 'currency', 'expense_date', 'payment_method_id', 'to_payment_method_id', 'refund_kind', 'refunded_at', 'refund_sms_log_id', 'sms_flags', 'deleted_at', 'retracted_by_sms_log_id', 'spend_exclusion', 'is_debt_payment', 'linked_debt_id']
const INC_KEYS = ['source_type', 'amount', 'currency', 'received_date', 'occurrence_date', 'payment_method_id', 'exclusion', 'sms_flags', 'deleted_at', 'retracted_by_sms_log_id']

function dump(run: ReplayRun, ids: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const id of ids) {
    const log = run.store.tables.sms_parse_log.find((l) => l.id === id)
    const o = run.outcomes.get(id)
    out[id] = {
      cls: replayClass(run, id),
      outcome: o?.outcome ?? null,
      kind: o?.kind ?? null,
      kindSource: o?.kindSource ?? null,
      skipped: run.skipped.get(id) ?? null,
      refused: run.refused.get(id) ?? null,
      refundRule: run.refundRule.get(id) ?? null,
      possibleDuplicate: run.possibleDuplicate.get(id) ?? null,
      paired: (log?.paired_log_id as string | null) ?? null,
      awaiting: !!log?.awaiting_confirmation,
      confirmedPass: o?.confirmedPass ?? false,
      debtPayment: !!o?.debtPaymentId,
      exp: ownExpenses(run, id).map((e) => ({ ...pick(e, EXP_KEYS), fee: e.description === 'Transfer fee' })),
      inc: ownIncomes(run, id).map((e) => pick(e, INC_KEYS)),
      stampedElsewhere: run.store.tables.expenses.filter((e) => e.refund_sms_log_id === id && e.sms_log_id !== id).map((e) => e.sms_log_id as string),
      retractedRows: [
        ...run.store.tables.expenses.filter((e) => e.retracted_by_sms_log_id === id && e.sms_log_id !== id).map((e) => e.sms_log_id as string),
        ...run.store.tables.income_events.filter((e) => e.retracted_by_sms_log_id === id && e.sms_log_id !== id).map((e) => e.sms_log_id as string),
      ],
    }
  }
  return out
}

describe.skipIf(!existsSync(EXPORT))('S3 dry-run dump', () => {
  it('writes the per-message replay dump', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms)
    const data = JSON.parse(readFileSync(EXPORT, 'utf8')) as ReplayExport
    const logs = readLogs(data)
    const ids = logs.map((l) => l.id)
    const A = await replay(data, { ownTransfer: 'stored', tick })
    const B = await replay(data, { ownTransfer: 'model', tick })
    const C = await replay(data, { ownTransfer: 'stored', digits: 'zeros', tick })
    vi.useRealTimers()
    const dumpA = dump(A, ids)
    const rules = Object.fromEntries(logs.filter((l) => l.body).map((l) => [l.id, { notice: isCollectedNotice(l.body as string), deposit: isCashDeposit(l.body as string) }]))
    const keys = Object.fromEntries(logs.filter((l) => l.body).map((l) => [l.id, { shape: coarseShapeKey(l.body as string, effectiveSender(l.sender, l.body as string, null)), format: coarseShapeKey(l.body as string, null) }]))
    writeFileSync(OUT, JSON.stringify({ rules, keys, A: dumpA, B: dump(B, ids), C: dump(C, ids), users: Object.fromEntries(logs.map((l) => [l.id, l.user])) }))
    expect(Object.keys(dumpA).length).toBe(ids.length)
  }, 180_000)
})
