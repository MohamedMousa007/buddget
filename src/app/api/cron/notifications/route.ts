/**
 * GET|POST /api/cron/notifications  (Supabase pg_cron hourly via net.http_post; the only scheduler: a second Vercel cron only produced duplicate-key errors)
 *
 * Due users come from one set-based query (notification_due_users: inside the 09:00-21:00 window and either alertable or near month end);
 * the pg_cron entry point (notifications_tick) does not call at all when nobody is due, and each page prefetches its users' rows in bulk.
 *
 * Evaluates the time-sensitive alerts (recurring debt due/tomorrow, month-end)
 * for every account and emits them as localized in-app notifications + OS push.
 * Each user is evaluated only between 09:00 and 21:00 in their own timezone (Cairo when none is reported), so an hourly
 * caller delivers at each user's 09:00 and the daily backup only reaches users already past 09:00.
 * Idempotent via notifications.dedupe_key — safe to run repeatedly.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { format } from 'date-fns'
import { budgetMonthKeyFor } from '@/lib/utils/calculations'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import { evaluateAlerts, renderAlertCopy } from '@/lib/notifications/evaluateAlerts'
import { emitNotification } from '@/lib/server/emitNotification'
import { evaluateSubscriptionAlerts, renderSubscriptionAlert } from '@/lib/notifications/evaluateSubscriptionAlerts'
import { subscriptionFromRow } from '@/lib/supabase/remote/mappers/subscriptionMapper'
import { expenseFromRow } from '@/lib/supabase/remote/mappers/expenseMapper'
import { goalFromRow } from '@/lib/supabase/remote/mappers/goalMapper'
import { evaluateGoalAlerts, renderGoalAlert } from '@/lib/notifications/evaluateGoalAlerts'
import { isDeliveryWindow, resolveUserTimeZone } from '@/lib/notifications/deliveryWindow'
import { CRON_LAST_RUN_KEY } from '@/lib/server/cronHealth'
import { wallClockNow } from '@/lib/time/deviceTimeZone'
import { median } from '@/lib/goals/fundingScenario'
import { normalizeRuns } from '@/lib/goals/goalDetail'

export const maxDuration = 60

const PAGE = 500
const CONCURRENCY = 8
const PREFETCH = 96 // a multiple of CONCURRENCY, so each chunk starts on a batch boundary
const TIME_BUDGET_MS = 48_000
const BULK = 1000 // PostgREST answers at most this many rows (Supabase max-rows), so bulk reads page through it
const IN_LIST = 100 // ids per `in (...)` filter, to keep each request URL short

type Rows = Record<string, unknown>[]
type Page = PromiseLike<{ data: unknown[] | null; error: unknown }>

/** Every row of a bulk read, a page at a time (the read must order by a unique key). Stops at the first error. */
async function allRows(read: (from: number, to: number) => Page): Promise<Rows> {
  const out: Rows = []
  for (let from = 0; ; from += BULK) {
    const { data, error } = await read(from, from + BULK - 1)
    if (error) {
      console.error('[cron/notifications] bulk read failed', error instanceof Error ? error.message : error)
      return out
    }
    out.push(...((data ?? []) as Rows))
    if (!data || data.length < BULK) return out
  }
}

/** `allRows` over an id list cut into URL-sized pieces. */
async function allRowsIn(ids: string[], read: (part: string[], from: number, to: number) => Page): Promise<Rows> {
  const parts: string[][] = []
  for (let i = 0; i < ids.length; i += IN_LIST) parts.push(ids.slice(i, i + IN_LIST))
  return (await Promise.all(parts.map((part) => allRows((from, to) => read(part, from, to))))).flat()
}

const groupBy = (rows: Rows, key: string) => {
  const m = new Map<string, Rows>()
  for (const r of rows) {
    const k = r[key] as string
    m.set(k, [...(m.get(k) ?? []), r])
  }
  return m
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceRoleClient()
  const utcNow = new Date()
  let emitted = 0
  let scanned = 0
  let skipped = 0
  const started = Date.now()

  // Only users with something that can alert get the full evaluation (the rest still get the month-end notice, which
  // needs no data). The run is resumable: if it nears the time limit it stores where it stopped and the next run
  // continues from there, so nobody is starved however many accounts there are.
  const { data: cursorRow } = await service.from('platform_settings').select('value').eq('key', 'notification_cron_cursor').maybeSingle()
  const startCursor = String((cursorRow?.value as { after?: string } | null)?.after ?? '')
  let cursor = startCursor

  let stoppedEarly = false
  for (;;) {
    const { data: settingsRows, error } = await service.rpc('notification_due_users', {
      p_now: utcNow.toISOString(),
      p_after: cursor || undefined,
      p_limit: PAGE,
    })
    if (error) {
      console.error('[cron/notifications] user_settings query failed', error)
      stoppedEarly = true // keep the cursor: resetting it would restart from the first user next run
      break
    }
    if (!settingsRows || settingsRows.length === 0) break

    // S8C-07: every read is one query per table for a chunk of users (paged and id-chunked), never one per user.
    const none = () => new Map<string, Rows>()
    let recurringBy = none()
    let debtsBy = none()
    let subsBy = none()
    let subExpensesBy = none()
    let goalsBy = none()
    let runsByGoalId = none()
    let summariesBy = none()
    let accountsBy = none()
    let depositsByAccount = none()
    const prefetch = async (rows: typeof settingsRows) => {
      const ids = rows.filter((r) => r.is_candidate).map((r) => r.user_id as string)
      if (ids.length === 0) {
        recurringBy = debtsBy = subsBy = subExpensesBy = goalsBy = runsByGoalId = summariesBy = accountsBy = depositsByAccount = none()
        return
      }
      const summarySince = format(new Date(utcNow.getTime() - 731 * 86_400_000), 'yyyy-MM')
      const [rec, debts, subs, goals, summaries, accounts] = await Promise.all([
        allRowsIn(ids, (p, a, b) => service.from('recurring_debt_payments').select('id, user_id, debt_id, amount, currency, next_due_date, is_active').in('user_id', p).eq('is_active', true).order('id').range(a, b)),
        allRowsIn(ids, (p, a, b) => service.from('debts').select('id, user_id, name').in('user_id', p).order('id').range(a, b)),
        allRowsIn(ids, (p, a, b) => service.from('subscriptions').select('*').in('user_id', p).is('deleted_at', null).in('status', ['active', 'trial']).order('id').range(a, b)),
        allRowsIn(ids, (p, a, b) => service.from('goals').select('*').in('user_id', p).is('deleted_at', null).eq('status', 'active').neq('funding_mode', 'manual').order('id').range(a, b)),
        allRowsIn(ids, (p, a, b) => service.from('savings_month_summary').select('user_id, month_key, saved, currency').in('user_id', p).gte('month_key', summarySince).order('user_id').order('month_key', { ascending: false }).range(a, b)),
        allRowsIn(ids, (p, a, b) => service.from('savings_accounts').select('id, user_id, current_balance, currency').in('user_id', p).is('deleted_at', null).order('id').range(a, b)),
      ])
      const since = format(new Date(utcNow.getTime() - 401 * 86_400_000), 'yyyy-MM-dd')
      const linked = [...new Set(goals.flatMap((g) => goalFromRow(g as never).linkedSavingsAccountIds))]
      const [subExpenses, runs, deposits] = await Promise.all([
        allRowsIn(subs.map((r) => r.id as string), (p, a, b) => service.from('expenses').select('*').in('linked_subscription_id', p).is('deleted_at', null).gte('expense_date', since).order('id').range(a, b)),
        allRowsIn(goals.map((g) => g.id as string), (p, a, b) => service.from('goal_allocation_runs').select('id, goal_id, period, planned, amount').in('goal_id', p).order('id').range(a, b)),
        allRowsIn(linked, (p, a, b) => service.from('savings_transactions').select('id, account_id, amount, currency, transaction_date, source, kind').in('account_id', p).eq('kind', 'deposit').is('deleted_at', null).order('id').range(a, b)),
      ])
      recurringBy = groupBy(rec, 'user_id')
      debtsBy = groupBy(debts, 'user_id')
      subsBy = groupBy(subs, 'user_id')
      subExpensesBy = groupBy(subExpenses, 'user_id')
      goalsBy = groupBy(goals, 'user_id')
      runsByGoalId = groupBy(runs, 'goal_id')
      summariesBy = groupBy(summaries, 'user_id')
      accountsBy = groupBy(accounts, 'user_id')
      depositsByAccount = groupBy(deposits, 'account_id')
    }

    const handleUser = async (s: (typeof settingsRows)[number]) => {
      const timeZone = resolveUserTimeZone(s.timezone as string | null)
      if (!isDeliveryWindow(utcNow, timeZone)) {
        skipped++
        return
      }
      scanned++
      const now = wallClockNow(utcNow, timeZone)
      const full = s.is_candidate
      const userId = s.user_id as string

      const recurringRows = full ? (recurringBy.get(userId) ?? []) : []

      const recurring = recurringRows.map((r) => ({
        id: r.id as string,
        debtId: r.debt_id as string,
        amount: Number(r.amount),
        currency: r.currency as string,
        nextDueDate: r.next_due_date as string,
        isActive: r.is_active as boolean,
      }))

      const debtNameById: Record<string, string> = {}
      const debtIds = new Set(recurring.map((r) => r.debtId))
      for (const d of debtsBy.get(userId) ?? []) if (debtIds.has(d.id as string)) debtNameById[d.id as string] = (d.name as string) ?? ''

      const descriptors = evaluateAlerts({
        now,
        monthStr: budgetMonthKeyFor(now, (s.month_start_day as number | null) ?? 1),
        monthStartDay: (s.month_start_day as number | null) ?? 1,
        recurring,
        debtNameById,
      })

      const dict = getServerDictionary(s.language as string | null)

      const subRows = full ? (subsBy.get(userId) ?? []) : []
      if (subRows.length > 0) {
        const since = format(new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
        const expRows = (subExpensesBy.get(userId) ?? []).filter((e) => (e.expense_date as string) >= since)
        const subAlerts = evaluateSubscriptionAlerts({
          today: now,
          subscriptions: subRows.map((r) => subscriptionFromRow(r as never)),
          expenses: expRows.map((r) => expenseFromRow(r as never)),
          dueReminders: (s.sub_due_reminders as boolean | null) ?? true,
          priceAlerts: (s.sub_price_alerts as boolean | null) ?? true,
        })
        for (const a of subAlerts) {
          const { title, body } = renderSubscriptionAlert(dict, a)
          const { created } = await emitNotification(service, {
            userId,
            category: a.type,
            severity: a.severity,
            dedupeKey: a.dedupeKey,
            title,
            body,
            push: { data: { kind: 'notification', notifType: a.type }, collapseKey: a.dedupeKey.slice(0, 60) },
          })
          if (created) emitted++
        }
      }

      // Behind-plan goals: one alert a month, after the second missed cycle.
      if (full && ((s.goal_alerts as boolean | null) ?? true)) {
        const goalRows = goalsBy.get(userId) ?? []
        if (goalRows.length > 0) {
          const runsR = { data: goalRows.flatMap((g) => runsByGoalId.get(g.id as string) ?? []) }
          const accR = { data: accountsBy.get(userId) ?? [] }
          const summaries = (summariesBy.get(userId) ?? []).slice(0, 3)
          // Run figures are in the user's base currency (summary currency); no FX here, so only same-currency goals.
          const baseCcy = (summaries[0]?.currency as string | undefined) ?? null
          const goals = goalRows.map((g) => goalFromRow(g as never)).filter((g) => g.currency === baseCcy)
          const linked = [...new Set(goals.flatMap((g) => g.linkedSavingsAccountIds))]
          const txRows = linked.flatMap((id) => depositsByAccount.get(id) ?? []).filter((t) => t.currency === baseCcy)
          const txs = txRows.map((t) => ({
            id: '', accountId: t.account_id as string, type: 'deposit' as const, amount: Number(t.amount),
            currency: t.currency as never, date: t.transaction_date as string, source: (t.source as string | null) ?? undefined,
          }))
          const rawRuns: Record<string, { period: string; planned: number; amount: number }[]> = {}
          for (const r of runsR.data ?? []) {
            ;(rawRuns[r.goal_id as string] ??= []).push({ period: r.period as string, planned: Number(r.planned), amount: Number(r.amount) })
          }
          const runsByGoal = Object.fromEntries(
            goals.map((g) => [g.id, normalizeRuns({ goal: g, runs: rawRuns[g.id] ?? [], txs, baseToGoal: (n) => n, toGoal: (a) => a })]),
          )
          const alerts = evaluateGoalAlerts({
            today: now,
            goals,
            runsByGoal,
            enabled: true,
            // Same-currency only: no FX on the server here, so a cross-currency goal gets no suggested amounts.
            usualKeepFor: (g) => {
              const same = summaries.filter((x) => x.currency === g.currency).map((x) => Number(x.saved))
              return same.length ? median(same) : null
            },
            currentFor: (g) =>
              g.manualCurrentAmount +
              (accR.data ?? []).filter((a) => g.linkedSavingsAccountIds.includes(a.id as string) && a.currency === g.currency).reduce((sum, a) => sum + Number(a.current_balance), 0),
          })
          for (const a of alerts) {
            const { title, body } = renderGoalAlert(dict, a)
            const { created } = await emitNotification(service, {
              userId, category: a.type, severity: a.severity, dedupeKey: a.dedupeKey, title, body,
              metadata: { goalId: a.goalId },
              push: { data: { kind: 'notification', notifType: a.type }, collapseKey: a.dedupeKey.slice(0, 60) },
            })
            if (created) emitted++
          }
        }
      }

      for (const a of descriptors) {
        const { title, body } = renderAlertCopy(dict, a)
        const { created } = await emitNotification(service, {
          userId,
          category: a.type,
          severity: a.severity,
          dedupeKey: a.dedupeKey,
          title,
          body,
          metadata: { ...a.params },
          push: { data: { kind: 'notification', notifType: a.type }, collapseKey: a.dedupeKey.slice(0, 60) },
        })
        if (created) emitted++
      }
    }

    // A handful of users at a time: the work per user is waiting on the database, not computing.
    for (let i = 0; i < settingsRows.length; i += CONCURRENCY) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        stoppedEarly = true
        break
      }
      if (i % PREFETCH === 0) await prefetch(settingsRows.slice(i, i + PREFETCH))
      const batch = settingsRows.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map((row) => handleUser(row).catch((e) => console.error('[cron/notifications] user failed', e instanceof Error ? e.message : e))))
      cursor = batch[batch.length - 1]!.user_id as string
    }
    if (stoppedEarly) break

    if (settingsRows.length < PAGE) break
  }

  const nextCursor = stoppedEarly ? cursor : ''
  const [cursorSave, runSave] = await Promise.all([
    nextCursor === startCursor ? { error: null } : service.from('platform_settings').upsert({ key: 'notification_cron_cursor', value: { after: nextCursor } }),
    service.from('platform_settings').upsert({ key: CRON_LAST_RUN_KEY, value: { at: new Date().toISOString(), scanned, skipped, emitted, partial: stoppedEarly } }),
  ])
  if (cursorSave.error || runSave.error) console.error('[cron/notifications] could not record the run', cursorSave.error?.message ?? runSave.error?.message)
  return NextResponse.json({ ok: true, scanned, skipped, emitted, partial: stoppedEarly })
}

// The hourly pg_cron job calls this with net.http_post; a GET-only route answered every call with 405.
export const POST = GET
