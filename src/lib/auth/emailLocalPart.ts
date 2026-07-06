/**
 * The part of an email before the `@` (e.g. `anamody007@gmail.com` → `anamody007`).
 * Used for friendly, privacy-safe greetings: the local-part is shown in place of
 * the full address, and a name is only ever shown once it has securely loaded.
 * Falls back to the trimmed input when there is no `@`.
 */
export function emailLocalPart(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  return at > 0 ? trimmed.slice(0, at) : trimmed
}
