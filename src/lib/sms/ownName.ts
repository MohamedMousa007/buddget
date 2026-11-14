/**
 * "Is the other party of this transfer the user themself?" (docs/launch/S1-sms-audit.md 6a.3)
 *
 * The receiving bank names the sender; when that name is the user's own, the money came from another of their
 * accounts. The comparison runs on the raw counterparty before anything is masked or stored, and only its boolean
 * result is kept. It is a SUPPORTING signal: the caller also requires the message's own account to be one the user
 * has confirmed, because two people can share a name.
 */
import type { ServiceClient } from '@/lib/supabase/service'

const DIACRITICS = /[ً-ْٰـ]/g

/** Name parts, folded: case, Arabic letter variants and marks, punctuation. One-letter parts (initials) are dropped. */
function parts(name: string): string[] {
  return name
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .split(/[^\p{L}]+/u)
    .filter((p) => [...p].length >= 2)
}

/**
 * True when the counterparty and one of the user's names share their first part and at least one more. A single
 * shared part never matches (a first name alone is half the country), and a bank that prints the full four-part
 * name still matches a profile that holds two of them.
 */
export function isOwnName(counterparty: string | null | undefined, names: readonly (string | null | undefined)[]): boolean {
  if (!counterparty) return false
  const theirs = parts(counterparty)
  if (theirs.length < 2) return false
  return names.some((name) => {
    const mine = name ? parts(name) : []
    if (mine.length < 2 || mine[0] !== theirs[0]) return false
    const set = new Set(theirs)
    return mine.filter((p) => set.has(p)).length >= 2
  })
}

/** The names the user goes by, from their profile. Never throws: no names means no match. */
export async function ownNames(service: ServiceClient, userId: string): Promise<string[]> {
  try {
    const { data } = await service.from('profiles').select('name, display_name').eq('id', userId).maybeSingle()
    return [data?.name, data?.display_name].filter((n): n is string => !!n && n.trim().length > 0)
  } catch {
    return []
  }
}

/** Kinds whose counterparty is a person, so their name is compared here and never written to the parse log's merchant. */
export function hasPersonCounterparty(kind: string | null | undefined): boolean {
  return kind === 'instant_transfer_in' || kind === 'instant_transfer_out' || kind === 'own_transfer'
}
