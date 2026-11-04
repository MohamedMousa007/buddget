/**
 * GET|POST /api/cron/notifications  (Supabase pg_cron hourly via net.http_post; Vercel Cron daily as backup)
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
const TIME_BUDGET_MS = 48_000

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
  const { data: candidateIds } = await service.rpc('notification_candidate_users')
  const candidates = new Set<string>((candidateIds ?? []) as string[])
  const { data: cursorRow } = await service.from('platform_settings').select('value').eq('key', 'notification_cron_cursor').maybeSingle()
  let cursor = String((cursorRow?.value as { after?: string } | null)?.after ?? '')

  let stoppedEarly = false
  for (;;) {
    let query = service
      .from('user_settings')
      .select('user_id, language, timezone, month_start_day, sub_due_reminders, sub_price_alerts, goal_alerts')
      .order('user_id', { ascending: true })
      .limit(PAGE)
    if (cursor) query = query.gt('user_id', cursor)
    const { data: settingsRows, error } = await query
    if (error) {
      console.error('[cron/notifications] user_settings query failed', error)
      stoppedEarly = true // keep the cursor: resetting it would restart from the first user next run
      break
    }
    if (!settingsRows || settingsRows.length === 0) break

    const handleUser = async (s: (typeof settingsRows)[number]) => {
      const timeZone = resolveUserTimeZone(s.timezone as string | null)
      if (!isDeliveryWindow(utcNow, timeZone)) {
        skipped++
        return
      }
      scanned++
      const now = wallClockNow(utcNow, timeZone)
      const full = candidates.has(s.user_id as string)
      const userId = s.user_id as string

      const { data: recurringRows } = full
        ? await service
            .from('recurring_debt_payments')
            .select('id, debt_id, amount, currency, next_due_date, is_active')
            .eq('user_id', userId)
            .eq('is_active', true)
        : { data: [] }

      const recurring = (recurringRows ?? []).map((r) => ({
        id: r.id as string,
        debtId: r.debt_id as string,
        amount: Number(r.amount),
        currency: r.currency as string,
        nextDueDate: r.next_due_date as string,
        isActive: r.is_active as boolean,
      }))

      const debtNameById: Record<string, string> = {}
      const debtIds = [...new Set(recurring.map((r) => r.debtId))]
      if (debtIds.length > 0) {
        const { data: debtRows } = await service
          .from('debts')
          .select('id, name')
          .eq('user_id', userId)
          .in('id', debtIds)
        for (const d of debtRows ?? []) debtNameById[d.id as string] = (d.name as string) ?? ''
      }

      const descriptors = evaluateAlerts({
        now,
        monthStr: budgetMonthKeyFor(now, (s.month_start_day as number | null) ?? 1),
        monthStartDay: (s.month_start_day as number | null) ?? 1,
        recurring,
        debtNameById,
      })

      const dict = getServerDictionary(s.language as string | null)

      const { data: subRows } = full
        ? await service
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .in('status', ['active', 'trial'])
        : { data: [] }
      if (subRows && subRows.length > 0) {
        const since = format(new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
        const { data: expRows } = await service
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .in('linked_subscription_id', subRows.map((r) => r.id as string))
          .gte('expense_date', since)
        const subAlerts = evaluateSubscriptionAlerts({
          today: now,
          subscriptions: subRows.map(subscriptionFromRow),
          expenses: (expRows ?? []).map(expenseFromRow),
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
        const { data: goalRows } = await service
          .from('goals').select('*').eq('user_id', userId).is('deleted_at', null).eq('status', 'active').neq('funding_mode', 'manual')
        if (goalRows && goalRows.length > 0) {
          const ids = goalRows.map((g) => g.id as string)
          const [runsR, summaryR, accR] = await Promise.all([
            service.from('goal_allocation_runs').select('goal_id, period, planned, amount').in('goal_id', ids),
            service.from('savings_month_summary').select('saved, currency').eq('user_id', userId).order('month_key', { ascending: false }).limit(3),
            service.from('savings_accounts').select('id, current_balance, currency').eq('user_id', userId).is('deleted_at', null),
          ])
          const summaries = summaryR.data ?? []
          // Run figures are in the user's base currency (summary currency); no FX here, so only same-currency goals.
          const baseCcy = (summaries[0]?.currency as string | undefined) ?? null
          const goals = goalRows.map(goalFromRow).filter((g) => g.currency === baseCcy)
          const linked = [...new Set(goals.flatMap((g) => g.linkedSavingsAccountIds))]
          const { data: txRows } = linked.length
            ? await service.from('savings_transactions').select('account_id, amount, currency, transaction_date, source, kind').in('account_id', linked).eq('kind', 'deposit').eq('currency', baseCcy as never).is('deleted_at', null).limit(5000)
            : { data: [] }
          const txs = (txRows ?? []).map((t) => ({
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
      const batch = settingsRows.slice(i, i + CONCURRENCY)
      await Promise.all(batch.map((row) => handleUser(row).catch((e) => console.error('[cron/notifications] user failed', e instanceof Error ? e.message : e))))
      cursor = batch[batch.length - 1]!.user_id as string
    }
    if (stoppedEarly) break

    if (settingsRows.length < PAGE) break
  }

  const [cursorSave, runSave] = await Promise.all([
    service.from('platform_settings').upsert({ key: 'notification_cron_cursor', value: { after: stoppedEarly ? cursor : '' } }),
    service.from('platform_settings').upsert({ key: CRON_LAST_RUN_KEY, value: { at: new Date().toISOString(), scanned, skipped, emitted, partial: stoppedEarly } }),
  ])
  if (cursorSave.error || runSave.error) console.error('[cron/notifications] could not record the run', cursorSave.error?.message ?? runSave.error?.message)
  return NextResponse.json({ ok: true, scanned, skipped, emitted, partial: stoppedEarly })
}

// The hourly pg_cron job calls this with net.http_post; a GET-only route answered every call with 405.
export const POST = GET
