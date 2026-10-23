import { createHash } from 'node:crypto'
import type { createServiceRoleClient } from '@/lib/supabase/service'

type Service = ReturnType<typeof createServiceRoleClient>

/** Stable uuid from a key: the idempotency token for one logical move, so a rerun cannot apply it twice. */
export function groupIdFor(key: string): string {
  const h = createHash('sha256').update(key).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/**
 * The account leftover money sits in: the user's oldest tracked bank account (then wallet). null while they track none,
 * in which case server deposits behave exactly as before accounts existed.
 */
export async function primaryTrackedAccountId(service: Service, userId: string): Promise<string | null> {
  const { data } = await service.from('payment_methods').select('id, type')
    .eq('user_id', userId).is('deleted_at', null).is('closed_at', null)
    .in('type', ['bank_account', 'wallet']).not('opening_balance', 'is', null).order('created_at', { ascending: true }).limit(5)
  const rows = data ?? []
  return (rows.find((r) => r.type === 'bank_account') ?? rows[0])?.id ?? null
}

/** Atomic, idempotent pocket deposit. The ledger leg names the account the money leaves, so net worth cannot be minted. */
export async function depositToPocket(service: Service, a: {
  userId: string; pocketId: string; amount: number; date: string; note: string; source: string; key: string; accountId: string | null
}): Promise<void> {
  const { error } = await service.rpc('adjust_pocket_balance', {
    p_user: a.userId, p_pocket: a.pocketId, p_delta: a.amount, p_kind: 'deposit', p_group: groupIdFor(a.key),
    p_payment_method: a.accountId ?? undefined, p_date: a.date, p_note: a.note, p_source: a.source,
  })
  if (error) throw new Error(`deposit failed: ${error.message}`)
}
