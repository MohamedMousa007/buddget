/**
 * GET /api/cron/notifications  (Vercel Cron, daily)
 *
 * Evaluates the time-sensitive alerts (recurring debt due/tomorrow, month-end)
 * for every account and emits them as localized in-app notifications + OS push.
 * Idempotent via notifications.dedupe_key — safe to run repeatedly.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { format } from 'date-fns'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import { evaluateAlerts, renderAlertCopy } from '@/lib/notifications/evaluateAlerts'
import { emitNotification } from '@/lib/server/emitNotification'

export const maxDuration = 60

const PAGE = 1000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceRoleClient()
  const now = new Date()
  const monthStr = format(now, 'yyyy-MM')
  let emitted = 0
  let scanned = 0

  for (let offset = 0; ; offset += PAGE) {
    const { data: settingsRows, error } = await service
      .from('user_settings')
      .select('user_id, language, month_start_day')
      .range(offset, offset + PAGE - 1)
    if (error) {
      console.error('[cron/notifications] user_settings query failed', error)
      break
    }
    if (!settingsRows || settingsRows.length === 0) break

    for (const s of settingsRows) {
      scanned++
      const userId = s.user_id as string

      const { data: recurringRows } = await service
        .from('recurring_debt_payments')
        .select('id, debt_id, amount, currency, next_due_date, is_active')
        .eq('user_id', userId)
        .eq('is_active', true)

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
        monthStr,
        monthStartDay: (s.month_start_day as number | null) ?? 1,
        recurring,
        debtNameById,
      })
      if (descriptors.length === 0) continue

      const dict = getServerDictionary(s.language as string | null)
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

    if (settingsRows.length < PAGE) break
  }

  return NextResponse.json({ ok: true, scanned, emitted })
}
