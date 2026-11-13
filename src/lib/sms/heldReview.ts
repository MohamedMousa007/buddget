import type { PendingConfirmation } from '@/hooks/useSmsConfirmations'

/** Kinds that are money coming in: the amount reads +, green, and confirming is a `success`. */
export const CREDIT_KINDS = new Set(['income', 'instant_transfer_in', 'refund'])

/**
 * Held messages were held for a reason, so nothing is chosen for the user. `ready` rows (a plain debit nothing has
 * been created for) are what "Select all ready" picks; `check` rows (a credit, or a currency still to confirm) need a
 * look; `locked` rows (unverified sender) can only be confirmed one at a time, from their own detail.
 */
export type HeldGroup = 'ready' | 'check' | 'locked'

type Held = Pick<PendingConfirmation, 'kind' | 'failure_code' | 'expense_id' | 'income_id'>

export const isCredit = (i: Pick<PendingConfirmation, 'kind'>): boolean => i.kind != null && CREDIT_KINDS.has(i.kind)

/** The transaction already exists (provisional currency); dismissing only stops the question. */
export const isCurrencyOnly = (i: Pick<PendingConfirmation, 'expense_id' | 'income_id'>): boolean => Boolean(i.expense_id || i.income_id)

export function heldGroup(i: Held): HeldGroup {
  if (i.failure_code === 'sender_mismatch') return 'locked'
  if (isCredit(i) || isCurrencyOnly(i)) return 'check'
  return 'ready'
}

export function groupHeld<T extends Held>(items: T[]): Record<HeldGroup, T[]> {
  const out: Record<HeldGroup, T[]> = { ready: [], check: [], locked: [] }
  for (const i of items) out[heldGroup(i)].push(i)
  return out
}

/** Which word the quiet secondary uses: it follows what dismissing actually does to the selected rows. */
export type DismissKind = 'dontAdd' | 'keepAsIs' | 'dismiss'

export function dismissKind(selected: Pick<PendingConfirmation, 'expense_id' | 'income_id'>[]): DismissKind {
  if (selected.length === 0) return 'dismiss'
  const currency = selected.filter(isCurrencyOnly).length
  if (currency === selected.length) return 'keepAsIs'
  if (currency === 0) return 'dontAdd'
  return 'dismiss'
}

/** Only "don't add" has something to take back (the message is never created); the rest change nothing. */
export const dismissNeedsUndo = (selected: Pick<PendingConfirmation, 'expense_id' | 'income_id'>[]): boolean => selected.some((i) => !isCurrencyOnly(i))

/**
 * "Don't add" has no server-side undo, so the dismiss call is held back for the length of the Undo toast and sent
 * then. `flush` sends everything still waiting at once (the sheet closed, the app went to the background), so a held
 * call is never lost to a normal exit; if the app is killed inside the window the message simply stays held.
 */
export function createDeferred(run: (ids: string[]) => Promise<void>, ms: number) {
  let seq = 0
  const waiting = new Map<number, { ids: string[]; timer: ReturnType<typeof setTimeout> }>()
  const fire = (n: number): Promise<void> => {
    const e = waiting.get(n)
    if (!e) return Promise.resolve()
    clearTimeout(e.timer)
    waiting.delete(n)
    return run(e.ids)
  }
  return {
    /** Returns a handle: `cancel()` is true when the call had not been sent yet (so the Undo worked). */
    schedule(ids: string[]): { cancel: () => boolean } {
      const n = ++seq
      waiting.set(n, { ids, timer: setTimeout(() => void fire(n), ms) })
      return {
        cancel: () => {
          const e = waiting.get(n)
          if (!e) return false
          clearTimeout(e.timer)
          waiting.delete(n)
          return true
        },
      }
    },
    flush: async (): Promise<void> => {
      await Promise.all([...waiting.keys()].map(fire))
    },
  }
}

/**
 * Runs one request per id, one after another, so a failure never hides the others. A thrown error counts as failed.
 * The caller keeps the failed ids selected and offers Retry.
 */
export async function runBatch(ids: string[], run: (id: string) => Promise<boolean>): Promise<{ ok: string[]; failed: string[] }> {
  const ok: string[] = []
  const failed: string[] = []
  for (const id of ids) {
    let done = false
    try {
      done = await run(id)
    } catch {
      done = false
    }
    if (done) ok.push(id)
    else failed.push(id)
  }
  return { ok, failed }
}
