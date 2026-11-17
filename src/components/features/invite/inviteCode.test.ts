import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillingMe } from '@/lib/billing/billingStore'
import { rewardsCopy } from '@/lib/i18n/rewardsCopy'
import type { ReferralFriend } from '@/lib/referrals/referralsApi'
import { INVITE_COOKIE, INVITE_STORAGE_KEY, clearRememberedInvite, displayLink, earnedView, friendRow, friendToRemind, inviteReward, normalizeInviteCode, readRememberedInvite, redeemRememberedInvite, rememberInvite } from './inviteCode'

// A browser's storage and cookie jar, small enough to read: the suite runs in node.
const store = new Map<string, string>()
const jar = new Map<string, string>()
vi.stubGlobal('window', { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } })
vi.stubGlobal('document', {
  get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
  set cookie(raw: string) {
    const [pair = ''] = raw.split(';')
    const [k = '', v = ''] = pair.split('=')
    if (/Max-Age=0/.test(raw)) jar.delete(k)
    else jar.set(k, v)
  },
})

beforeEach(() => clearRememberedInvite())

describe('an invite code', () => {
  it('is upper case with one hyphen; anything else is not a code', () => {
    expect(normalizeInviteCode(' layla-7k2 ')).toBe('LAYLA-7K2')
    expect(normalizeInviteCode('AB-7K2')).toBe('AB-7K2')
    for (const bad of ['', 'LAYLA', 'LAYLA-7', '../x', 'A-B-C', 'LAYLA 7K2', null]) expect(normalizeInviteCode(bad)).toBeNull()
  })
  it('a typed code is remembered; a link’s cookie is read when nothing was typed', () => {
    expect(readRememberedInvite()).toBeNull()
    document.cookie = `${INVITE_COOKIE}=OMAR-9QX; Path=/`
    expect(readRememberedInvite()).toBe('OMAR-9QX')
    rememberInvite('LAYLA-7K2')
    expect(readRememberedInvite()).toBe('LAYLA-7K2')
    clearRememberedInvite()
    expect(window.localStorage.getItem(INVITE_STORAGE_KEY)).toBeNull()
    expect(readRememberedInvite()).toBeNull()
  })
})

describe('redeeming after sign-up', () => {
  it('no remembered code: the server is not called', async () => {
    const redeem = vi.fn()
    expect(await redeemRememberedInvite(redeem)).toBeNull()
    expect(redeem).not.toHaveBeenCalled()
  })
  it('redeems the remembered code with the device id, then forgets it', async () => {
    rememberInvite('LAYLA-7K2')
    const redeem = vi.fn().mockResolvedValue({ status: 'ok', trialExtended: true })
    expect(await redeemRememberedInvite(redeem, 'device-1')).toBe('ok')
    expect(redeem).toHaveBeenCalledWith('LAYLA-7K2', 'device-1')
    expect(readRememberedInvite()).toBeNull()
  })
  it.each(['invalid_code', 'self_invite', 'account_too_old', 'already_redeemed', 'device_used', 'disabled'] as const)('%s is final: the code is dropped and never asked again', async (status) => {
    rememberInvite('LAYLA-7K2')
    expect(await redeemRememberedInvite(vi.fn().mockResolvedValue({ status }))).toBe(status)
    expect(readRememberedInvite()).toBeNull()
  })
  it('a failed call keeps the code for the next start', async () => {
    rememberInvite('LAYLA-7K2')
    expect(await redeemRememberedInvite(vi.fn().mockResolvedValue({ status: 'error' }))).toBe('error')
    expect(readRememberedInvite()).toBe('LAYLA-7K2')
  })
})

describe('what an invite earns', () => {
  const me = (over: Partial<BillingMe>): BillingMe => ({ planKey: 'free', planName: 'Free', status: 'active', trialEndsAt: null, billingEnabled: true, sparks: null, ...over })
  const sub = { fromStore: true, billingIssue: false, graceEndsAt: null, willRenew: true, renewsAt: '2027-11-17T00:00:00Z', productId: 'pro_annual', memberSince: '2026-11-17T00:00:00Z' }
  it('a week of Pro for Free, a trial and a gifted Pro; 500 Sparks for a paying store subscriber', () => {
    expect(inviteReward(me({}))).toBe('pro_week')
    expect(inviteReward(me({ planKey: 'plus_trial', status: 'trialing', trialEndsAt: '2026-12-16T00:00:00Z' }))).toBe('pro_week')
    expect(inviteReward(me({ planKey: 'plus', subscription: { ...sub, fromStore: false } }))).toBe('pro_week')
    expect(inviteReward(me({ planKey: 'plus', subscription: sub }))).toBe('sparks')
  })
  it('the earned card counts whole weeks, or Sparks, and never hides what was earned the other way', () => {
    expect(earnedView({ rewards: { proDaysEarned: 14, proDaysBanked: 7, sparksEarned: 0 } }, 'pro_week')).toEqual({ kind: 'pro_week', amount: 2 })
    expect(earnedView({ rewards: { proDaysEarned: 0, proDaysBanked: 0, sparksEarned: 1000 } }, 'sparks')).toEqual({ kind: 'sparks', amount: 1000 })
    expect(earnedView({ rewards: { proDaysEarned: 14, proDaysBanked: 0, sparksEarned: 0 } }, 'sparks')).toEqual({ kind: 'pro_week', amount: 2 })
    expect(earnedView({ rewards: { proDaysEarned: 0, proDaysBanked: 0, sparksEarned: 0 } }, 'pro_week')).toEqual({ kind: 'pro_week', amount: 0 })
  })
})

describe('a friend in the list', () => {
  const f = rewardsCopy.en.invite.friend
  const friend = (over: Partial<ReferralFriend>): ReferralFriend => ({ id: 1, name: 'Sara', joined_at: '2026-11-03T10:00:00Z', status: 'pending', active_days: 2, active_days_needed: 3, transactions: 3, transactions_needed: 5, window_ends_at: '2026-11-17T10:00:00Z', reward_kind: null, ...over })
  const date = () => '3 Nov'
  it('still in their window: progress out of 3 days', () => {
    expect(friendRow(friend({}), f, date)).toMatchObject({ status: 'almost', name: 'Sara', initials: 'SA', detail: 'Active 2 of 3 days', statusLabel: 'Almost there', progress: { done: 2, total: 3 } })
    expect(friendRow(friend({ active_days: 0 }), f, date).statusLabel).toBe('Just joined')
  })
  it('rewarded: what it paid, by the kind the server recorded', () => {
    expect(friendRow(friend({ status: 'rewarded', reward_kind: 'pro_week' }), f, date)).toMatchObject({ status: 'done', detail: 'Joined 3 Nov · stuck with it', statusLabel: '+1 week' })
    expect(friendRow(friend({ status: 'rewarded', reward_kind: 'sparks' }), f, date).statusLabel).toBe('+500 Sparks')
  })
  it('the quiet endings carry no reward', () => {
    expect(friendRow(friend({ status: 'expired' }), f, date).statusLabel).toBe('Didn’t stick')
    expect(friendRow(friend({ status: 'capped' }), f, date).statusLabel).toBe('Past this month’s limit')
    expect(friendRow(friend({ status: 'clawed_back', name: null }), f, date)).toMatchObject({ name: 'A friend', statusLabel: 'Not counted' })
  })
  it('the reminder goes to a named friend still in their window', () => {
    expect(friendToRemind([friend({ status: 'rewarded' }), friend({ id: 2, name: 'Omar' })])?.name).toBe('Omar')
    expect(friendToRemind([friend({ status: 'rewarded' }), friend({ name: null })])).toBeNull()
  })
  it('the link shows without its scheme', () => {
    expect(displayLink('https://buddget.app/i/LAYLA-7K2')).toBe('buddget.app/i/LAYLA-7K2')
  })
})
