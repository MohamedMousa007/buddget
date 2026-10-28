import { describe, it, expect } from 'vitest'
import { evaluateCronHealth, cronConfigWarning, CRON_STALE_SECONDS } from './cronHealth'

const NOW = Date.parse('2026-10-28T12:00:00Z')
const base = { secretSet: true, lastRunAt: '2026-10-28T06:00:10Z', nowMs: NOW, outbox: { pending: 0, dead: 0, oldestPendingAt: null } }

describe('evaluateCronHealth', () => {
  it('is healthy with a recent run, a secret and a quiet outbox', () => {
    const h = evaluateCronHealth(base)
    expect(h.ok).toBe(true)
    expect(h.issues).toEqual([])
    expect(h.notificationCronAgeSeconds).toBe(21590)
  })
  it('flags a missing secret', () => {
    expect(evaluateCronHealth({ ...base, secretSet: false }).issues).toContain('cron_secret_missing')
  })
  it('flags a cron that never ran or is stale', () => {
    expect(evaluateCronHealth({ ...base, lastRunAt: null }).issues).toContain('notification_cron_never_ran')
    const old = new Date(NOW - (CRON_STALE_SECONDS + 60) * 1000).toISOString()
    expect(evaluateCronHealth({ ...base, lastRunAt: old }).issues).toContain('notification_cron_stale')
  })
  it('flags dead outbox rows and a stuck backlog', () => {
    expect(evaluateCronHealth({ ...base, outbox: { pending: 0, dead: 2, oldestPendingAt: null } }).issues).toContain('outbox_dead_rows')
    const stuck = new Date(NOW - 7 * 3600_000).toISOString()
    expect(evaluateCronHealth({ ...base, outbox: { pending: 3, dead: 0, oldestPendingAt: stuck } }).issues).toContain('outbox_backlog')
  })
  it('never exposes the secret value', () => {
    process.env.CRON_SECRET = 'top-secret-value'
    expect(JSON.stringify(evaluateCronHealth(base))).not.toContain('top-secret-value')
    delete process.env.CRON_SECRET
  })
})

describe('cronConfigWarning', () => {
  it('warns only in production when the secret is unset', () => {
    expect(cronConfigWarning({ NODE_ENV: 'production' })).toMatch(/CRON_SECRET/)
    expect(cronConfigWarning({ NODE_ENV: 'production', CRON_SECRET: 'x' })).toBeNull()
    expect(cronConfigWarning({ NODE_ENV: 'development' })).toBeNull()
  })
  it('does not include any secret value', () => {
    expect(cronConfigWarning({ NODE_ENV: 'production', CRON_SECRET: '' })).not.toMatch(/=/)
  })
})
