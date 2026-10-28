import { ageSeconds } from '@/lib/health/buildInfo'

/** The notifications cron also runs daily as a backup; a gap past a day and a half means it has stopped. */
export const CRON_STALE_SECONDS = 36 * 60 * 60
export const OUTBOX_STUCK_SECONDS = 6 * 60 * 60
export const CRON_LAST_RUN_KEY = 'notification_cron_last_run'

export interface CronHealthInput {
  secretSet: boolean
  lastRunAt: string | null
  nowMs: number
  outbox: { pending: number; dead: number; oldestPendingAt: string | null } | null
}

export interface CronHealth {
  ok: boolean
  cronSecretConfigured: boolean
  notificationCronAgeSeconds: number | null
  outboxPending: number | null
  outboxDead: number | null
  issues: string[]
}

/** Pure verdict over what the deep health check read. Reports flags and counts only, never a secret value. */
export function evaluateCronHealth(i: CronHealthInput): CronHealth {
  const issues: string[] = []
  const age = ageSeconds(i.lastRunAt, i.nowMs)
  if (!i.secretSet) issues.push('cron_secret_missing')
  if (age === null) issues.push('notification_cron_never_ran')
  else if (age > CRON_STALE_SECONDS) issues.push('notification_cron_stale')
  if (i.outbox) {
    if (i.outbox.dead > 0) issues.push('outbox_dead_rows')
    const oldest = ageSeconds(i.outbox.oldestPendingAt, i.nowMs)
    if (i.outbox.pending > 0 && oldest !== null && oldest > OUTBOX_STUCK_SECONDS) issues.push('outbox_backlog')
  }
  return {
    ok: issues.length === 0,
    cronSecretConfigured: i.secretSet,
    notificationCronAgeSeconds: age,
    outboxPending: i.outbox?.pending ?? null,
    outboxDead: i.outbox?.dead ?? null,
    issues,
  }
}

/** A startup warning when production would answer every cron call with 401. Names the variable only. */
export function cronConfigWarning(env: Record<string, string | undefined>): string | null {
  if (env.NODE_ENV !== 'production' || env.CRON_SECRET) return null
  return '[startup] CRON_SECRET is not set: every cron route will reject Vercel cron calls (notifications, prices, integrations, sms-harvest)'
}
