/** FCM answers a bad payload with the same `invalid-argument` as a bad token: only these two codes mean the token itself is dead. */
const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'])
export const isDeadTokenCode = (code: string): boolean => DEAD_TOKEN_CODES.has(code)

/** APNs rejects an `apns-collapse-id` over 64 bytes. */
export const capCollapseKey = (key: string | undefined): string | undefined => (key ? Array.from(key).reduce((out, ch) => (new TextEncoder().encode(out + ch).length <= 64 ? out + ch : out), '') : undefined)

const RESERVED_DATA_KEY = /^(from|message_type|collapse_key|google\..*|gcm\..*)$/i

/** FCM refuses a message whose data uses a reserved key. */
export function safeData(data: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!data) return data
  return Object.fromEntries(Object.entries(data).filter(([k]) => !RESERVED_DATA_KEY.test(k)))
}
