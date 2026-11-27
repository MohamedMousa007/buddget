/**
 * GET /api/cron/month-carry  (daily 05:00 UTC, vercel.json; scheduled 2026-11-05 after a dry run)
 *
 * Sweeps each user's real month-end surplus into savings once their cycle has closed (F2).
 * income − spend − allocated, floored at 0, posted as a normal deposit dated to the closed month's
 * last day, into the resolved destination pocket. Closed cycles with no savings_month_summary row are
 * caught up, so a missed run only delays the carry. Idempotent per (user, month_key). Fails closed:
 * with no live FX rates, or a currency that cannot be converted, nothing is posted. Push-only
 * notification, no in-app card, no undo.
 *
 * ⚠️ WRITES LIVE MONEY. Scheduled after a dry run and the owner's sign-off (2026-11-05). `?dryRun=1` reads everything the real run reads, writes nothing, and answers with aggregate counts and
 * totals only (no user ids). Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { depositToPocket, primaryTrackedAccountId } from '@/lib/server/pocketLedger'
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { DEFAULT_USER_TIME_ZONE, isValidTimeZone } from '@/lib/server/userTimeZone'
import { pendingCarryKeys } from '@/lib/savings/carryDateLogic'
import { computeMonthCarry, findUnlinkedGoalPocket } from '@/lib/savings/monthCarry'
import { carryPostDate, closedCycleDrift, fetchRates, loadCycle, must } from '@/lib/server/carryCycle'
import { claimCarryAdjustment, releaseCarryClaim, type CarryClaim } from '@/lib/server/carryAdjust'
import { convertCurrency } from '@/lib/utils/currency'
import { allocateGoalFunding } from '@/lib/server/allocateGoalFunding'
import { emitNotification } from '@/lib/server/emitNotification'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import { renderServerCopy } from '@/lib/notifications/serverCopy'
import { goalMilestoneAlert, renderGoalAlert } from '@/lib/notifications/evaluateGoalAlerts'
import { systemVaultId } from '@/lib/savings/pocketIdentity'

type Service = ReturnType<typeof createServiceRoleClient>
type Rates = Record<string, number>
interface UserSettingsRow { user_id: unknown; month_start_day: unknown; language: unknown; goal_progress_alerts: unknown; timezone: unknown }

export const maxDuration = 60
const PAGE = 500
/** Stop starting new users this long into the run so the function ends cleanly inside `maxDuration` instead of being killed mid-user. */
const TIME_BUDGET_MS = 50_000

const userZone = (tz: unknown) => (typeof tz === 'string' && isValidTimeZone(tz) ? tz : DEFAULT_USER_TIME_ZONE)

/** What a dry run reports: how many cycles would be swept and for how much, never who. */
interface DryRun {
  users: number
  cycles: number
  withCarry: number
  empty: number
  skippedFirstPartial: number
  noFxPath: number
  carryByCurrency: Record<string, number>
}

/** Carries one closed cycle for one user. Returns true when money moved or the cycle was recorded as empty. */
async function carryCycle(service: Service, s: UserSettingsRow, monthKey: string, rates: Rates, now: Date, claims: CarryClaim[], dry?: DryRun): Promise<boolean> {
  const userId = s.user_id as string
  const monthStartDay = (s.month_start_day as number | null) ?? 1
  const { start, end, base, profileCreatedAt, accounts, savingsPockets, goals, dest, destCurrency, figures } = await loadCycle(service, userId, monthKey, monthStartDay, rates)

  // First partial cycle: an account created after the cycle started shouldn't carry a full month.
  if (profileCreatedAt && profileCreatedAt > start) {
    if (dry) dry.skippedFirstPartial++
    return false
  }

  if (!figures) {
    if (dry) dry.noFxPath++
    else {
      console.error('[cron/month-carry] no FX path, skipped', userId, monthKey)
      // Recorded as an empty cycle so it neither blocks the newer cycles nor is retried forever.
      must(await service.from('savings_month_summary').insert({ user_id: userId, month_key: monthKey, target: 0, allocated: 0, carry: 0, saved: 0, currency: base, closed_at: now.toISOString() }), 'skipped summary')
    }
    return false
  }
  const { income, spend, allocated } = figures
  // Earlier closed months whose rows changed since they were swept: each is claimed (compare-and-set) before it is netted into this carry, so a tap or another run cannot settle it too.
  let prior: Awaited<ReturnType<typeof closedCycleDrift>>[number]['item'][] = []
  try {
    prior = (await closedCycleDrift(service, userId, monthStartDay, rates, { before: monthKey })).map((p) => p.item).filter((p) => p.stale)
  } catch (e) {
    console.error('[cron/month-carry] prior drift unreadable, nothing netted', userId, e instanceof Error ? e.message : e)
  }
  let netted = prior
  if (!dry) {
    netted = []
    for (const p of prior) {
      const claim = await claimCarryAdjustment(service, userId, p, Math.round((p.adjustment + p.delta) * 100) / 100)
      if (claim) { claims.push(claim); netted.push(p) }
    }
  }
  let priorAdjustment = netted.reduce((n, p) => n + p.delta, 0)
  // Netting that would push the carry below zero would drop the rest: net nothing, so those months stay stale for the user's tap.
  if (computeMonthCarry({ income, spend, allocated }).carryRaw + priorAdjustment < 0) {
    for (const c of claims.splice(0)) await releaseCarryClaim(service, userId, c)
    priorAdjustment = 0
  }
  const { carry, carryRaw, saved } = computeMonthCarry({ income, spend, allocated, priorAdjustment })
  const carryAdjustment = Math.round((carryRaw - carry) * 100) / 100
  if (dry) {
    dry.cycles++
    if (carry >= 0.01) {
      dry.withCarry++
      dry.carryByCurrency[base] = Math.round(((dry.carryByCurrency[base] ?? 0) + carry) * 100) / 100
    } else dry.empty++
    return true
  }

  const postDate = carryPostDate(end)
  // Funded goals draw first (priority order); the rest is unassigned and stays free.
  const dict = getServerDictionary(s.language as string | null)
  const celebrate = (s.goal_progress_alerts as boolean | null) ?? true
  const remainder = await allocateGoalFunding({
    service, userId, monthKey, carry, base, rates, goals, accounts, postDate,
    onCheckpoint: async (goal, pct, saved) => {
      if (pct >= 100) must(await service.from('goals').update({ status: 'achieved', achieved_at: now.toISOString() }).eq('id', goal.id), 'goal achieved')
      if (!celebrate) return
      const a = goalMilestoneAlert(goal, pct, saved)
      const { title, body } = renderGoalAlert(dict, a)
      await emitNotification(service, {
        userId, category: a.type, severity: a.severity, dedupeKey: a.dedupeKey, title, body, metadata: { goalId: goal.id },
        push: { data: { kind: 'notification', notifType: a.type }, collapseKey: a.dedupeKey.slice(0, 60) },
      })
    },
  })
  if (remainder < 0.01) {
    // Nothing to sweep, but record the closed cycle so it isn't reconsidered.
    must(await service.from('savings_month_summary').insert({ user_id: userId, month_key: monthKey, target: 0, allocated, carry, carry_adjustment: carryAdjustment, saved, currency: base, closed_at: now.toISOString() }), 'summary')
    claims.length = 0
    return true
  }

  const primaryId = await primaryTrackedAccountId(service, userId, base)
  // An existing system vault with no holder is outside every account: setting the leftover aside there would count it twice.
  const vaultOutside = dest.kind === 'create-vault' && savingsPockets.some((p) => p.id === systemVaultId(userId) && !p.heldInPaymentMethodId)
  if ((dest.kind !== 'pocket' && !primaryId) || vaultOutside) {
    // No account in the base currency to set the leftover aside in: record the cycle, set nothing aside.
    must(await service.from('savings_month_summary').insert({ user_id: userId, month_key: monthKey, target: 0, allocated, carry, carry_adjustment: carryAdjustment, saved, currency: base, closed_at: now.toISOString() }), 'summary')
    claims.length = 0
    return true
  }
  let pocketId: string
  if (dest.kind === 'pocket') {
    pocketId = dest.pocketId
  } else {
    const goal = dest.kind === 'create-goal-pocket' ? goals.find((g) => g.id === dest.goalId) : undefined
    const orphan = dest.kind === 'create-goal-pocket' ? findUnlinkedGoalPocket(savingsPockets, goals, dest.name, base) : undefined
    if (orphan) {
      pocketId = orphan.id
    } else {
      const name = dest.kind === 'create-goal-pocket' ? dest.name : 'Monthly Savings'
      const row = { user_id: userId, name, category: 'savings' as const, type: 'vault' as const, currency: base, current_balance: 0, opening_balance: 0, is_emergency_cover: false, held_in_payment_method_id: primaryId }
      if (dest.kind === 'create-vault') {
        // The system vault has one id per user, the same one the client seeds: a race with the app converges on one row.
        pocketId = systemVaultId(userId)
        must(await service.from('savings_accounts').upsert({ ...row, id: pocketId }, { onConflict: 'id', ignoreDuplicates: true }), 'create vault')
        // Duplicates are ignored so a live vault keeps its balance; a soft-deleted one must come back or the carry lands in a deleted pocket.
        must(await service.from('savings_accounts').update({ deleted_at: null }).eq('id', pocketId).eq('user_id', userId).not('deleted_at', 'is', null), 'revive vault')
      } else {
        const { data: created } = must(await service.from('savings_accounts').insert(row).select('id').single(), 'create pocket')
        pocketId = created!.id as string
      }
    }
    if (dest.kind === 'create-vault') must(await service.from('profiles').update({ default_carry_pocket_id: pocketId }).eq('id', userId), 'default pocket')
    // The goal owns its pocket from now on, so the next cycle resolves to it instead of minting another.
    else if (goal) must(await service.from('goals').update({ linked_savings_account_ids: [...goal.linkedSavingsAccountIds, pocketId] }).eq('id', goal.id), 'link goal pocket')
  }

  // Post the carry: a real deposit dated to the closed month's last day.
  const carryInPocketCcy = convertCurrency(remainder, base, destCurrency, rates)
  // A rerun after a crash must not sweep twice: the deposit's note is unique per cycle.
  const alreadySwept = must(await service
    .from('savings_transactions').select('id').eq('user_id', userId).eq('source', 'carry')
    .eq('notes', `Month-end carry · ${monthKey}`).is('deleted_at', null).limit(1).maybeSingle(), 'dedupe check').data
  if (!alreadySwept) {
    await depositToPocket(service, {
      userId, pocketId, amount: carryInPocketCcy, date: postDate, source: 'carry',
      note: `Month-end carry · ${monthKey}`, key: `month-carry|${userId}|${monthKey}`, accountId: null,
    })
  }

  must(await service.from('savings_month_summary').insert({
    user_id: userId, month_key: monthKey, target: 0, allocated, carry, carry_adjustment: carryAdjustment, saved, currency: base, pocket_id: pocketId, closed_at: now.toISOString(),
  }), 'summary')
  claims.length = 0

  await emitNotification(service, {
    userId, category: 'savings_carry', severity: 'success', dedupeKey: `carry:${monthKey}`,
    ...renderServerCopy(dict, { kind: 'carry', amount: remainder, currency: base }),
    metadata: { monthKey, carry }, push: { data: { kind: 'notification', notifType: 'savings_carry' }, collapseKey: `carry:${monthKey}` },
  })
  return true
}

async function carryUser(service: Service, s: UserSettingsRow, rates: Rates, now: Date, dry?: DryRun): Promise<number> {
  const userId = s.user_id as string
  const latest = must(await service
    .from('savings_month_summary').select('month_key').eq('user_id', userId).order('month_key', { ascending: false }).limit(1).maybeSingle(), 'latest summary').data
  const keys = pendingCarryKeys(now, (s.month_start_day as number | null) ?? 1, (latest?.month_key as string | undefined) ?? null, userZone(s.timezone))
  let carried = 0
  if (dry && keys.length > 0) dry.users++
  for (const key of keys) {
    const claims: CarryClaim[] = []
    try {
      if (await carryCycle(service, s, key, rates, now, claims, dry)) carried++
    } catch (e) {
      for (const c of claims) await releaseCarryClaim(service, userId, c).catch(() => undefined)
      throw e
    }
  }
  return carried
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rates = await fetchRates()
  if (Object.keys(rates).length === 0) {
    console.error('[cron/month-carry] FX rates unavailable, aborting')
    return NextResponse.json({ error: 'FX rates unavailable' }, { status: 503 })
  }

  const now = new Date()
  const service = createServiceRoleClient()
  // Paused 2026-11-27 (council deep logic check): writes only with MONTH_CARRY_WRITES=on, until the month-end card and
  // its single capped server action replace this path. Paused runs evaluate like a dry run and write nothing.
  const paused = process.env.MONTH_CARRY_WRITES !== 'on'
  const dry: DryRun | undefined = paused || new URL(request.url).searchParams.get('dryRun') === '1'
    ? { users: 0, cycles: 0, withCarry: 0, empty: 0, skippedFirstPartial: 0, noFxPath: 0, carryByCurrency: {} }
    : undefined
  let carried = 0
  let scanned = 0
  let failed = 0
  const startedAt = Date.now()
  let cursor = new URL(request.url).searchParams.get('after') ?? ''
  let partial = false
  let lastScanned = cursor

  scan: for (;;) {
    let query = service
      .from('user_settings')
      .select('user_id, month_start_day, language, goal_progress_alerts, timezone')
      .order('user_id', { ascending: true })
      .limit(PAGE)
    if (cursor) query = query.gt('user_id', cursor)
    const { data: settings, error } = await query
    if (error) {
      console.error('[cron/month-carry] user_settings query failed', error)
      return NextResponse.json({ ok: false, scanned, carried, failed, error: 'user_settings query failed' }, { status: 500 })
    }
    if (!settings || settings.length === 0) break

    for (const s of settings) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        partial = true
        break scan
      }
      scanned++
      try {
        carried += await carryUser(service, s, rates, now, dry)
      } catch (e) {
        failed++
        console.error('[cron/month-carry] user failed', s.user_id, e instanceof Error ? e.message : e)
      }
      lastScanned = s.user_id as string
    }
    cursor = settings[settings.length - 1]!.user_id as string
    if (settings.length < PAGE) break
  }
  if (partial) console.error('[cron/month-carry] time budget reached; resume with ?after=<last scanned user>', { scanned })

  // A dry run evaluates cycles but carries nothing: `carried` stays 0 and the evaluated count is `cycles`.
  return NextResponse.json({ ok: failed === 0 && !partial, ...(paused ? { paused: true } : {}), ...(dry ? { dryRun: true, ...dry } : {}), ...(partial ? { partial: true, nextCursor: lastScanned } : {}), scanned, carried: dry ? 0 : carried, failed })
}

// pg_cron + pg_net calls with POST; Vercel crons call GET. Same handler, same auth.
export const POST = GET
