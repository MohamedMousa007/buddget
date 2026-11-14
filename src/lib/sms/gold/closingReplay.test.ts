import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  liveClass, livePairs, logOf, ownExpenses, ownIncomes, pairsOf, readLogs, replay, replayClass,
  type KindSourceMode, type LogIn, type ReplayExport, type ReplayRun,
} from './closingReplay'

/**
 * Local export of scripts/qa/sms-s2c-replay-inputs.sql (masked text and account names: never committed). Without it the
 * whole replay is skipped, so CI does not run it.
 */
const EXPORT = process.env.SMS_S2C_REPLAY ?? path.resolve(__dirname, '../../../../.claude/sms-s2c-replay.json')

type Verdict = { ok: boolean | null; evidence: string }
interface Result { check: string; a: string; b: string; c: string; evidence: string }

const label = (ok: boolean | null): string => (ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL')

describe.skipIf(!existsSync(EXPORT))('S2c closing replay (order-aware, needs the local export)', () => {
  let data: ReplayExport
  let logs: LogIn[]
  let A: ReplayRun
  let B: ReplayRun
  let C: ReplayRun
  const swapped: Partial<Record<KindSourceMode, ReplayRun>> = {}
  const natural: Partial<Record<KindSourceMode, ReplayRun>> = {}
  const results: Result[] = []
  const head: string[] = []

  beforeAll(async () => {
    // The pairing code sleeps 400 ms between looks; only the timer is faked so the run takes seconds.
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms)
    data = JSON.parse(readFileSync(EXPORT, 'utf8')) as ReplayExport
    logs = readLogs(data)
    A = await replay(data, { ownTransfer: 'stored', tick })
    B = await replay(data, { ownTransfer: 'model', tick })
    C = await replay(data, { ownTransfer: 'stored', digits: 'zeros', tick })
    for (const mode of ['stored', 'model'] as const) {
      natural[mode] = await replay(data, { ownTransfer: mode, users: ['u10'], tick })
      swapped[mode] = await replay(data, { ownTransfer: mode, users: ['u10'], swap: ['0fe8887c', '1ccc2355'], tick })
    }
    vi.useRealTimers()

    for (const [name, run] of [['A  stored own_transfer as code', A], ['B  stored own_transfer as model (non fully_curated)', B], ['C  as A, with the masked digits read as zeros (supplementary, not asserted)', C]] as const) {
      const skipped: Record<string, number> = {}
      for (const r of run.skipped.values()) skipped[r] = (skipped[r] ?? 0) + 1
      const refused = [...run.refused.values()].reduce<Record<string, number>>((m, r) => ({ ...m, [r.rule]: (m[r.rule] ?? 0) + 1 }), {})
      const outcomes: Record<string, number> = {}
      for (const o of run.outcomes.values()) outcomes[o.outcome] = (outcomes[o.outcome] ?? 0) + 1
      head.push(
        `${name}: exported ${run.total}, dispatched ${run.dispatched}, skipped ${run.skipped.size} ${JSON.stringify(skipped)}, refused by the copy guard ${run.refused.size} ${JSON.stringify(refused)}, possible_duplicate flagged ${run.possibleDuplicate.size}, template direction overrides ${run.templateOverrides.length}`,
        `   dispatch outcomes ${JSON.stringify(outcomes)}`,
      )
      if (name.startsWith('A')) {
        head.push(`   refused as the same capture (copy <- earlier row): ${[...run.refused].map(([id, r]) => `${id} <- ${r.of}`).join(', ')}`)
        const bothBooked = [...run.possibleDuplicate].filter(([id, of]) => [id, of].every((x) => logs.find((l) => l.id === x)?.liveExpense || logs.find((l) => l.id === x)?.liveIncome)).length
        head.push(`   possible_duplicate flags ${run.possibleDuplicate.size}, of which both rows are also booked in the live data ${bothBooked} (an upper bound: masked text makes different messages look alike)`)
      }
    }
  }, 180_000)

  afterAll(() => {
    const w = [Math.max(...results.map((r) => r.check.length), 5), 4, 4, 4]
    const line = (r: Result) => `${r.check.padEnd(w[0])} | ${r.a.padEnd(w[1])} | ${r.b.padEnd(w[2])} | ${r.c.padEnd(w[3])} | ${r.evidence}`
    console.log(['', 'S2c closing replay', ...head, '', line({ check: 'check', a: 'A', b: 'B', c: 'C', evidence: 'evidence (log ids are 8-character prefixes)' }), ...results.map(line), ''].join('\n'))
  })

  /** Runs a check in both kind-source modes (A, B), and in C for information. A failure in A or B fails the test. */
  function both(check: string, fn: (run: ReplayRun, mode: KindSourceMode) => Verdict): void {
    it(check, () => {
      const a = fn(A, 'stored')
      const b = fn(B, 'model')
      const c = fn(C, 'stored')
      const evidence = [a.evidence, b.evidence === a.evidence ? null : `B: ${b.evidence}`, c.evidence === a.evidence ? null : `C: ${c.evidence}`].filter(Boolean)
      results.push({ check, a: label(a.ok), b: label(b.ok), c: label(c.ok), evidence: evidence.length > 1 ? `A: ${evidence.join(' || ')}` : evidence[0] as string })
      if (a.ok !== null) expect(a.ok, `A: ${a.evidence}`).toBe(true)
      if (b.ok !== null) expect(b.ok, `B: ${b.evidence}`).toBe(true)
    })
  }

  const liveRows = (run: ReplayRun, id: string) => ownExpenses(run, id).filter((e) => e.deleted_at == null)
  const untouched = (run: ReplayRun, id: string): boolean => {
    const rows = liveRows(run, id)
    return rows.length === 1 && rows[0].refunded_at == null && rows[0].refund_kind == null && rows[0].refund_sms_log_id == null
  }

  both('a. live repayment pairs still pair (30657ada+a602aba1, 346f56a6+34a081d4)', (run) => {
    const parts = [['30657ada', 'a602aba1'], ['346f56a6', '34a081d4']].map(([payoff, funding]) => {
      const paired = logOf(run, payoff)?.paired_log_id === funding && logOf(run, funding)?.paired_log_id === payoff
      const repayment = liveRows(run, payoff).filter((e) => e.category === 'CC Payoff')
      const fundingLive = liveRows(run, funding)
      const retired = ownExpenses(run, funding).filter((e) => e.deleted_at != null)
      const marked = retired.every((e) => e.retracted_by_sms_log_id === payoff)
      const ok = paired && repayment.length === 1 && fundingLive.length === 0 && marked
      return { ok, text: `${payoff}+${funding} paired=${paired}, repayment rows ${repayment.length}, debt payment ${run.outcomes.get(payoff)?.debtPaymentId ? 'yes' : 'no'}, funding live rows ${fundingLive.length}, funding retired with marker ${retired.length ? marked : 'n/a (never booked)'}` }
    })
    return { ok: parts.every((p) => p.ok), evidence: parts.map((p) => p.text).join('; ') }
  })

  both('b. refunds still stamp their transfers (fb2d543a->d84e8bcd, e66b72ae->7104f131)', (run) => {
    const parts = [['fb2d543a', 'd84e8bcd'], ['e66b72ae', '7104f131']].map(([refund, transfer]) => {
      const row = ownExpenses(run, transfer)[0]
      const stamped = row?.refund_kind === 'refunded' && row?.refund_sms_log_id === refund
      return { ok: stamped, text: `${refund}->${transfer} stamped=${stamped} by rule ${run.refundRule.get(refund) ?? 'none'}` }
    })
    return { ok: parts.every((p) => p.ok), evidence: parts.map((p) => p.text).join('; ') }
  })

  /** Rows other than the message's own that carry its stamp: a decline must never have any. */
  const stampedElsewhere = (run: ReplayRun, id: string) => run.store.tables.expenses.filter((e) => e.refund_sms_log_id === id && e.sms_log_id !== id).map((e) => e.sms_log_id as string)

  both('c. 9e75b537 is not stamped by the decline 0fe8887c', (run) => ({
    ok: untouched(run, '9e75b537') && ownExpenses(run, '0fe8887c').length === 1 && stampedElsewhere(run, '0fe8887c').length === 0,
    evidence: `9e75b537 expense untouched=${untouched(run, '9e75b537')}, 0fe8887c books ${ownExpenses(run, '0fe8887c').length} own net-zero row, rows it stamped elsewhere ${stampedElsewhere(run, '0fe8887c').length}`,
  }))

  it('d. 1ccc2355 is untouched by 0fe8887c in both arrival orders', () => {
    const verdicts = (['stored', 'model'] as const).map((mode) => {
      const per = (['natural', 'swapped'] as const).map((order) => {
        const run = (order === 'natural' ? natural : swapped)[mode] as ReplayRun
        const ok = untouched(run, '1ccc2355') && untouched(run, '9e75b537') && ownExpenses(run, '0fe8887c').length === 1
        return { ok, text: `${order}: 1ccc2355 untouched=${untouched(run, '1ccc2355')}, 9e75b537 untouched=${untouched(run, '9e75b537')}` }
      })
      return { ok: per.every((p) => p.ok), text: per.map((p) => p.text).join(', ') }
    })
    results.push({ check: 'd. 1ccc2355 untouched in both arrival orders', a: label(verdicts[0].ok), b: label(verdicts[1].ok), c: '-', evidence: verdicts[0].text === verdicts[1].text ? verdicts[0].text : `A: ${verdicts[0].text} || B: ${verdicts[1].text}` })
    expect(verdicts.every((v) => v.ok), verdicts.map((v) => v.text).join(' || ')).toBe(true)
  })

  both('e. 4a382257 is refused as a copy of 76184aa7', (run) => {
    const refusal = run.refused.get('4a382257')
    const booked = run.outcomes.has('76184aa7')
    return {
      ok: refusal?.of === '76184aa7' && booked && ownExpenses(run, '4a382257').length === 0,
      evidence: `refused=${refusal ? `${refusal.rule} of ${refusal.of}` : 'no'}, 76184aa7 booked=${booked}, 4a382257 own rows ${ownExpenses(run, '4a382257').length}`,
    }
  })

  both('f. four daily identical declines give one own row plus three acknowledgements', (run) => {
    const first = ownExpenses(run, '13248a70')
    const others = ['b4dba45d', '4d5206be', '8bc752a7'].map((id) => run.outcomes.get(id))
    const acks = others.filter((o) => o?.outcome === 'refund_matched' && o.expenseId === first[0]?.id).length
    const stray = ['b4dba45d', '4d5206be', '8bc752a7'].reduce((n, id) => n + ownExpenses(run, id).length, 0)
    return {
      ok: first.length === 1 && first[0].refund_kind === 'declined' && acks === 3 && stray === 0,
      evidence: `13248a70 own net-zero rows ${first.length}, acknowledgements against it ${acks} of 3, stray rows ${stray}`,
    }
  })

  both('g. 6e9e1e26 ("paid into your card" wording) is not booked as spending', (run) => {
    const o = run.outcomes.get('6e9e1e26')
    const cls = replayClass(run, '6e9e1e26')
    return { ok: cls !== 'spend' && !!o, evidence: `6e9e1e26 kind ${o?.kind}, outcome ${o?.outcome}${o?.confirmedPass ? ' then confirmed' : ''}, class ${cls}, kindSource ${o?.kindSource}` }
  })

  both('h. 4a7d7250 does not stamp 572aaf39; baab5343 vs bfe884e3 (rule that matches now)', (run) => {
    const o = run.outcomes.get('baab5343')
    const rule = run.refundRule.get('baab5343')
    const original = ownExpenses(run, 'bfe884e3')[0]
    return {
      ok: untouched(run, '572aaf39') && stampedElsewhere(run, '4a7d7250').length === 0,
      evidence: `572aaf39 untouched=${untouched(run, '572aaf39')}, rows 4a7d7250 stamped elsewhere ${stampedElsewhere(run, '4a7d7250').length}; baab5343 outcome ${o?.outcome}, rule ${rule ?? 'none'}, stamped [${stampedElsewhere(run, 'baab5343').join(' ')}], bfe884e3 stamped=${original?.refunded_at != null} (INFO, not asserted)`,
    }
  })

  /** Live pairs the replay cannot reproduce from masked text, with the reason. */
  const NOT_REPLAYABLE: Record<string, string> = {
    '50641027+cafcae46': 'direction lost to digit masking',
    '985f7ad6+b0854359': 'direction lost to digit masking',
    '6ad46d1d+eedf39da': 'reference masked, and the stored kind is the applied one',
  }
  const DIRECTION_PAIRS = Object.keys(NOT_REPLAYABLE).filter((p) => NOT_REPLAYABLE[p].startsWith('direction'))

  it('i. pairs: every replayable live pair still pairs; the rest are listed as not replayable', () => {
    const live = livePairs(logs)
    const per = [['A', A], ['B', B], ['C', C]].map(([name, run]) => {
      const now = pairsOf(run as ReplayRun)
      const lost = [...live].filter((p) => !now.has(p))
      const lostReplayable = lost.filter((p) => !(p in NOT_REPLAYABLE) || (name === 'C' && DIRECTION_PAIRS.includes(p)))
      const extra = [...now].filter((p) => !live.has(p))
      return { name, lost, lostReplayable, extra, ok: lostReplayable.length === 0 }
    })
    const text = per.map((r) => `${r.name}: ${live.size - r.lost.length} of ${live.size} pair, NOT REPLAYABLE [${r.lost.filter((p) => !r.lostReplayable.includes(p)).map((p) => `${p} (${NOT_REPLAYABLE[p]})`).join(', ')}], REGRESSED [${r.lostReplayable.join(' ')}], replay-only pairs [${r.extra.join(' ')}]`).join(' || ')
    results.push({ check: 'i. live pairs still pair', a: label(per[0].ok), b: label(per[1].ok), c: label(per[2].ok), evidence: text })
    expect(per.every((r) => r.ok), text).toBe(true)
  })

  it('l. the repayment rows of the user with no card debt, by outcome', () => {
    const rows = logs.filter((l) => l.kind === 'cc_payoff' && l.user === 'u10')
    const describe = (run: ReplayRun, id: string): string => {
      const o = run.outcomes.get(id)
      const e = ownExpenses(run, id).find((r) => r.deleted_at == null)
      if (!e) return o?.outcome === 'awaiting_confirmation' ? 'waits for user' : 'no row'
      return (e.sms_flags as string[] | null)?.includes('model_kind_unproven') && replayClass(run, id) === 'spend' ? 'spending+flag' : replayClass(run, id)
    }
    const tally = (run: ReplayRun) => rows.reduce<Record<string, number>>((m, r) => ({ ...m, [describe(run, r.id)]: (m[describe(run, r.id)] ?? 0) + 1 }), {})
    const cOk = rows.length === 7 && rows.every((r) => describe(C, r.id) === 'spending+flag')
    results.push({
      check: 'l. via-card repayment rows', a: 'INFO', b: 'INFO', c: label(cOk),
      evidence: `${rows.map((r) => r.id).join(' ')}; A ${JSON.stringify(tally(A))} B ${JSON.stringify(tally(B))} (the card digits after "via" are masked, so the wording is unreadable); C ${JSON.stringify(tally(C))}`,
    })
    expect(cOk, JSON.stringify(tally(C))).toBe(true)
  })

  both('j. totals: rows whose outcome class changed versus live', (run) => {
    const reasons: Record<string, number> = {}
    let changed = 0
    let bookedThenNone = 0
    let bookedThenNoneNowBooked = 0
    for (const l of logs) {
      const live = liveClass(data, l.id, l.storedMoneyId)
      const now = replayClass(run, l.id)
      if (live === 'booked_then_none') {
        bookedThenNone += 1
        if (now !== 'none') bookedThenNoneNowBooked += 1
        continue
      }
      if (live === now) continue
      changed += 1
      const liveExp = data.liveExp.find((r) => r[0] === l.id)
      const o = run.outcomes.get(l.id)
      const bookedAs = ownExpenses(run, l.id)[0]?.category
      const why = run.refused.has(l.id) ? 'refused_as_copy'
        : run.skipped.has(l.id) ? `skipped_${run.skipped.get(l.id)}`
        : live === 'netzero' && liveExp?.[2] === 'declined' && liveExp[3] !== l.id ? 'decline_no_longer_stamps'
        : live === 'netzero' && liveExp?.[2] === 'refunded' && liveExp[3] !== l.id ? 'refund_stamp_changed_or_lost'
        : live === 'income' && now === 'netzero' ? 'refund_unmatched_now_out_of_income'
        : live === 'income' && now === 'none' ? 'income_leg_now_retracted_by_a_new_pair'
        : live === 'nonspend' && now === 'spend' ? (o?.kindSource === 'model' && (l.kind === 'own_transfer' || l.kind === 'cc_payoff') ? 'model_kind_now_spending' : 'live_nonspend_category_on_a_purchase_user_edit_or_old_relabel')
        : live === 'spend' && now === 'nonspend' ? (bookedAs === 'Transfer' ? 'purchase_now_own_wallet_transfer' : `spend_to_nonspend_${bookedAs}`)
        : now === 'none' ? `no_money_row_now_${o?.outcome ?? 'n/a'}`
        : live === 'none' && now === 'netzero' ? 'new_net_zero_row_for_decline_or_unmatched_refund'
        : live === 'none' ? `live_had_no_row_replay_books_${now}`
        : `${live}_to_${now}`
      reasons[why] = (reasons[why] ?? 0) + 1
    }
    let flagged = 0
    const flagCounts: Record<string, number> = {}
    for (const l of logs) {
      const rows = [...ownExpenses(run, l.id), ...ownIncomes(run, l.id)].filter((r) => r.deleted_at == null)
      const flags = rows.flatMap((r) => (r.sms_flags as string[] | null) ?? [])
      const liveFlags = [...data.liveExp, ...data.liveInc].filter((r) => r[0] === l.id).some((r) => (r[r.length - 1] as unknown[] | null)?.length)
      if (flags.length && !liveFlags) {
        flagged += 1
        for (const f of new Set(flags)) flagCounts[f] = (flagCounts[f] ?? 0) + 1
      }
    }
    return {
      ok: null,
      evidence: `${changed} of ${logs.length} changed class; by reason ${JSON.stringify(reasons)}; live rows with a stored money id but no live row of their own ${bookedThenNone} (replay books ${bookedThenNoneNowBooked} of them, not counted above); rows with a flag added ${flagged} ${JSON.stringify(flagCounts)}`,
    }
  })

  it('k. wording guard count over template and curated_db rows', async () => {
    const mod = await import('./wordingGuardCount').catch(() => null)
    if (!mod) {
      results.push({ check: 'k. wording guard count', a: 'N/A', b: 'N/A', c: '-', evidence: 'countWordingGuardHits is not exported from src/lib/sms/gold yet; re-run when it is' })
      return
    }
    const rows = logs.filter((l) => (l.parseMethod === 'template' || l.parseMethod === 'curated_db') && l.body).map((l) => ({ body: l.body as string, templateGuardWords: [] as string[] }))
    const count = mod.countWordingGuardHits(rows)
    results.push({ check: 'k. wording guard count', a: 'INFO', b: 'INFO', c: '-', evidence: `${count.hits} of ${count.rows} rows hit with an empty per-template word list; per word ${JSON.stringify(count.perWord)}` })
    expect(count.rows).toBeGreaterThan(0)
  })
})
