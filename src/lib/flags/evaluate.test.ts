import { describe, expect, it } from 'vitest'
import { bucketOf, flagOn, type FlagContext, type FlagRow } from './evaluate'

const row: FlagRow = { key: 'onboarding_v1', enabled: true, rollout_pct: 10, platforms: [], plan_keys: [] }
const ctx: FlagContext = { userId: 'u-1', platform: 'ios', planKey: 'free', isStaff: false }

describe('flagOn', () => {
  it('a missing or disabled flag is off, even for staff', () => {
    expect(flagOn(undefined, ctx)).toBe(false)
    expect(flagOn({ ...row, enabled: false }, { ...ctx, isStaff: true })).toBe(false)
  })
  it('rollout is a stable bucket: the same user always gets the same answer, and widening never flips anyone off', () => {
    expect(bucketOf('onboarding_v1', 'u-1')).toBe(bucketOf('onboarding_v1', 'u-1'))
    const ids = Array.from({ length: 400 }, (_, i) => `user-${i}`)
    const at10 = ids.filter((id) => flagOn(row, { ...ctx, userId: id }))
    const at50 = ids.filter((id) => flagOn({ ...row, rollout_pct: 50 }, { ...ctx, userId: id }))
    expect(at10.every((id) => at50.includes(id))).toBe(true)
    expect(at10.length).toBeGreaterThan(10)
    expect(at10.length).toBeLessThan(80)
    expect(ids.every((id) => flagOn({ ...row, rollout_pct: 100 }, { ...ctx, userId: id }))).toBe(true)
    expect(ids.some((id) => flagOn({ ...row, rollout_pct: 0 }, { ...ctx, userId: id }))).toBe(false)
  })
  it('staff see an enabled flag whatever the rollout', () => {
    expect(flagOn({ ...row, rollout_pct: 0 }, { ...ctx, isStaff: true })).toBe(true)
  })
  it('respects platform and plan targeting', () => {
    expect(flagOn({ ...row, rollout_pct: 100, platforms: ['android'] }, ctx)).toBe(false)
    expect(flagOn({ ...row, rollout_pct: 100, platforms: ['ios'] }, ctx)).toBe(true)
    expect(flagOn({ ...row, rollout_pct: 100, plan_keys: ['pro'] }, ctx)).toBe(false)
  })
})
