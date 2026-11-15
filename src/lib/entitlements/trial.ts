/**
 * The identity a trial is claimed under: lower case, and for Gmail (and its googlemail.com alias) with dots removed and
 * everything from `+` dropped, so one mailbox cannot make many trials. Other domains keep dots and tags, which there
 * name different mailboxes. Null when the text is not an address.
 */
export function normalizeEmailKey(email: string): string | null {
  const value = email.trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at < 1 || at === value.length - 1) return null
  let local = value.slice(0, at)
  let domain = value.slice(at + 1)
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') local = local.split('+')[0]!.replace(/\./g, '')
  return local ? `${local}@${domain}` : null
}

export type TrialStatus = 'granted' | 'billing_off' | 'already_entitled' | 'already_claimed' | 'daily_cap' | 'invalid_email' | 'unverified'
