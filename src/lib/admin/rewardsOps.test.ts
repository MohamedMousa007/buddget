import { describe, expect, it } from 'vitest'
import { isPermission } from './permissions'
import { parseRewardsOp, REWARDS_OP_PERMISSION, sparksBuckets, SWITCH_PERMISSION } from './rewardsOps'

const NOW = Date.parse('2026-11-17T12:00:00Z')

describe('parseRewardsOp', () => {
  it('maps every action and switch to a real permission', () => {
    for (const p of [...Object.values(REWARDS_OP_PERMISSION), ...Object.values(SWITCH_PERMISSION)]) expect(isPermission(p)).toBe(true)
  })

  it('grants Pro until removed or until a future date only', () => {
    expect(parseRewardsOp({ op: 'grant_pro' }, NOW)).toMatchObject({ ok: true, value: { endsAt: null, note: null } })
    expect(parseRewardsOp({ op: 'grant_pro', endsAt: '2026-12-01T00:00:00Z', note: 'x' }, NOW)).toMatchObject({ ok: true, value: { endsAt: '2026-12-01T00:00:00.000Z', note: 'x' } })
    expect(parseRewardsOp({ op: 'grant_pro', endsAt: '2026-11-01T00:00:00Z' }, NOW).ok).toBe(false)
    expect(parseRewardsOp({ op: 'grant_pro', endsAt: '2040-01-01T00:00:00Z' }, NOW).ok).toBe(false)
    expect(parseRewardsOp({ op: 'grant_pro', endsAt: 'soon' }, NOW).ok).toBe(false)
  })

  it('needs a reason for Sparks and trims it', () => {
    expect(parseRewardsOp({ op: 'adjust_sparks', amount: 10, bucket: 'reward' }).ok).toBe(false)
    expect(parseRewardsOp({ op: 'adjust_sparks', amount: 10, bucket: 'reward', reason: ' test ' })).toMatchObject({ ok: true, permission: 'sparks.manage', value: { reason: 'test' } })
    expect(parseRewardsOp({ op: 'adjust_sparks', amount: 100_001, bucket: 'reward', reason: 'x' }).ok).toBe(false)
  })

  it('takes whole numbers only, in range', () => {
    expect(parseRewardsOp({ op: 'start_trial', days: '30' }).ok).toBe(false)
    expect(parseRewardsOp({ op: 'start_trial', days: 90 }).ok).toBe(true)
    expect(parseRewardsOp({ op: 'bank_days', days: 367 }).ok).toBe(false)
    expect(parseRewardsOp({ op: 'add_freezes', count: 0 }).ok).toBe(false)
    expect(parseRewardsOp({ op: 'set_founder', number: 0 }).ok).toBe(false)
    expect(parseRewardsOp({ op: 'approve_referral', referralId: [1, 2] }).ok).toBe(false)
  })

  it('rejects unknown actions, including prototype keys', () => {
    for (const op of ['toString', 'constructor', 'delete', undefined]) expect(parseRewardsOp({ op }).ok).toBe(false)
    expect(parseRewardsOp(null).ok).toBe(false)
  })
})

describe('sparksBuckets', () => {
  it('sums open allowances per kind and unrefunded purchases', () => {
    const iso = (ms: number) => new Date(NOW + ms).toISOString()
    expect(sparksBuckets({
      available: 0,
      allowances: [
        { id: '1', kind: 'plan', granted: 50, used: 20, period_start: iso(-1000), period_end: iso(1000), ref: null, reason: null },
        { id: '2', kind: 'plan', granted: 50, used: 0, period_start: iso(-5000), period_end: iso(-1000), ref: null, reason: null },
        { id: '3', kind: 'reward', granted: 10, used: 12, period_start: iso(-1000), period_end: iso(1000), ref: null, reason: null },
      ],
      purchases: [
        { id: 'a', store: 'app_store', product_id: 'p', sparks: 100, bonus_sparks: 0, remaining: 40, purchased_at: iso(-1), refunded_at: null },
        { id: 'b', store: 'app_store', product_id: 'p', sparks: 100, bonus_sparks: 0, remaining: 100, purchased_at: iso(-1), refunded_at: iso(-1) },
      ],
      spend: [],
    }, NOW)).toEqual({ plan: 30, reward: 0, purchased: 40 })
  })
})
