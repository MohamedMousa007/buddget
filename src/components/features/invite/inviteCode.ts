import type { FriendRowProps } from '@/components/features/membership/InviteBlocks'
import { isStoreSubscriber } from '@/components/features/billing/planBilling'
import type { BillingMe } from '@/lib/billing/billingStore'
import type { RewardsCopy } from '@/lib/i18n/rewardsCopy'
import type { RedeemStatus, ReferralFriend, ReferralSummary } from '@/lib/referrals/referralsApi'
import { INVITER_PRO_DAYS } from '@/lib/referrals/rules'

/** Where a code from an invite link or the sign-up field waits until the account exists. */
export const INVITE_STORAGE_KEY = 'buddget:invite-code'
/** Set by the `/i/<code>` page, read once by the app and copied into storage. */
export const INVITE_COOKIE = 'buddget_invite'
const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** A code as the server stores it ("LAYLA-7K2", "AB-7K2"): upper case, letters and digits around one hyphen. Null when it cannot be one. */
export function normalizeInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toUpperCase()
  return /^[A-Z0-9]{1,12}-[A-Z0-9]{2,8}$/.test(code) ? code : null
}

function readCookie(): string | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${INVITE_COOKIE}=`))
  return hit ? decodeURIComponent(hit.slice(INVITE_COOKIE.length + 1)) : null
}

export function rememberInvite(code: string): void {
  try { window.localStorage.setItem(INVITE_STORAGE_KEY, code) } catch { /* private mode: the cookie from the link still carries it */ }
}

/** What the invite link page does on open: keeps the code for sign-up, in storage and in the 30-day cookie the old link route set. */
export function saveInviteFromLink(code: string): void {
  rememberInvite(code)
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${INVITE_COOKIE}=${encodeURIComponent(code)}; Max-Age=${INVITE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`
}

/** The remembered code: the one typed or stored earlier, else the one the invite link left in its cookie. */
export function readRememberedInvite(): string | null {
  let stored: string | null = null
  try { stored = window.localStorage.getItem(INVITE_STORAGE_KEY) } catch { /* unreadable storage */ }
  return normalizeInviteCode(stored) ?? normalizeInviteCode(readCookie())
}

export function clearRememberedInvite(): void {
  try { window.localStorage.removeItem(INVITE_STORAGE_KEY) } catch { /* nothing stored */ }
  if (typeof document !== 'undefined') document.cookie = `${INVITE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

/** A redeem answer that will never change: the code is dropped. Only a failed call is worth another try. */
export const isFinalRedeem = (status: RedeemStatus): boolean => status !== 'error'

/**
 * Redeems the remembered code for the signed-in account, once. Resolves the server's answer, or null when no code waits.
 * The code is forgotten on every final answer, so an old account never keeps asking.
 */
export async function redeemRememberedInvite(redeem: (code: string, deviceId?: string | null) => Promise<{ status: RedeemStatus }>, deviceId?: string | null): Promise<RedeemStatus | null> {
  const code = readRememberedInvite()
  if (!code) return null
  const { status } = await redeem(code, deviceId)
  if (isFinalRedeem(status)) clearRememberedInvite()
  return status
}

/** What an activated friend earns the inviter: Sparks for a paying store subscriber, a week of Pro for everyone else. */
export type InviteReward = 'sparks' | 'pro_week'
export const inviteReward = (me: BillingMe | null): InviteReward => (isStoreSubscriber(me) ? 'sparks' : 'pro_week')

/** The earned card's figures: whole weeks of Pro, or Sparks, by what this person is earning now (falling back to whatever they did earn). */
export function earnedView(summary: Pick<ReferralSummary, 'rewards'>, reward: InviteReward): { kind: InviteReward; amount: number } {
  const weeks = Math.floor(summary.rewards.proDaysEarned / INVITER_PRO_DAYS)
  const sparks = summary.rewards.sparksEarned
  if (reward === 'sparks') return sparks > 0 || weeks === 0 ? { kind: 'sparks', amount: sparks } : { kind: 'pro_week', amount: weeks }
  return weeks > 0 || sparks === 0 ? { kind: 'pro_week', amount: weeks } : { kind: 'sparks', amount: sparks }
}

/** One friend as the list draws them: rewarded friends in green with what they earned, friends still in their window with their progress. */
export function friendRow(friend: ReferralFriend, f: RewardsCopy['invite']['friend'], formatDate: (iso: string) => string): Pick<FriendRowProps, 'status' | 'initials' | 'name' | 'detail' | 'statusLabel' | 'progress'> {
  const name = friend.name?.trim() || f.unnamed
  const base = { name, initials: (friend.name?.trim() || '?').slice(0, 2).toUpperCase() }
  const joined = formatDate(friend.joined_at)
  switch (friend.status) {
    case 'rewarded':
      return { ...base, status: 'done', detail: f.joinedStuck(joined), statusLabel: friend.reward_kind === 'sparks' ? f.plusSparks : f.plusWeek }
    case 'activated':
      if (friend.held === 'awaiting_native') return { ...base, status: 'almost', detail: f.joinedNative(joined), statusLabel: f.heldNative }
      if (friend.held === 'review') return { ...base, status: 'almost', detail: f.joinedStuck(joined), statusLabel: f.heldReview }
      return { ...base, status: 'done', detail: f.joinedStuck(joined), statusLabel: f.onItsWay }
    case 'capped':
      return { ...base, status: 'almost', detail: f.joinedStuck(joined), statusLabel: f.overCap }
    case 'pending': {
      const days = Math.min(friend.active_days, friend.active_days_needed)
      return { ...base, status: 'almost', detail: f.active(days, friend.active_days_needed, Math.min(friend.transactions, friend.transactions_needed), friend.transactions_needed), statusLabel: days > 0 ? f.almost : f.justJoined, progress: { done: days, total: friend.active_days_needed } }
    }
    case 'expired':
      return { ...base, status: 'almost', detail: f.joined(joined), statusLabel: f.didNotStick }
    default:
      return { ...base, status: 'almost', detail: f.joined(joined), statusLabel: f.notCounted }
  }
}

/** The friend a reminder is offered for: the newest one still inside their window. */
export const friendToRemind = (friends: readonly ReferralFriend[]): ReferralFriend | null => friends.find((x) => x.status === 'pending' && !!x.name?.trim()) ?? null

/** "buddget.app/i/LAYLA-7K2": the link without its scheme, as the link row shows it. */
export const displayLink = (link: string): string => link.replace(/^https?:\/\//, '')
