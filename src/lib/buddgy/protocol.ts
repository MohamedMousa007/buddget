/** Wire contract between the Buddgy client and `/api/buddgy/turn`. Isomorphic: no store or React imports. */

export type BuddgyLocale = 'en' | 'ar'

/** What the on-device router thinks the user wants; the server uses it to pick a tier and an output cap. */
export type BuddgyIntent = 'action' | 'answer' | 'advice'

export type WireMessage =
  | { role: 'user'; text: string }
  /** Plain model text, or the raw Gemini parts of a tool-calling turn (kept opaque for thought signatures). */
  | { role: 'model'; text?: string; parts?: unknown[] }
  | { role: 'tool'; results: WireToolResult[] }

export interface WireToolResult {
  name: string
  response: unknown
}

export interface WireToolCall {
  name: string
  args: Record<string, unknown>
}

export interface TurnRequest {
  /** Server-issued on the first turn; omit to start a chat. */
  chatId?: string
  /** True for a tool-loop continuation inside one user turn. */
  hop?: boolean
  messages: WireMessage[]
  /** Compact snapshot of "now" built on the device. */
  context: string
  /** Rule-folded recap of turns older than the verbatim window. */
  carry?: string
  locale: BuddgyLocale
  intent?: BuddgyIntent
}

export type TurnEvent =
  | { t: 'meta'; chatId: string | null; newChat: boolean; rolled: boolean; soft: boolean; tier: string }
  | { t: 'text'; d: string }
  /** The model wants tools run. `parts` must be echoed back verbatim in the next request. */
  | { t: 'calls'; parts: unknown[]; calls: WireToolCall[] }
  | { t: 'done'; units: number; finish: string; truncated: boolean }
  | { t: 'error'; code: TurnErrorCode; layer?: string; resetAt?: string | null }

export type TurnErrorCode = 'unauthorized' | 'quota' | 'not_configured' | 'bad_request' | 'upstream' | 'blocked' | 'empty'

export const TURN_LIMITS = {
  maxMessages: 16,
  maxMessageChars: 4000,
  maxTotalChars: 24000,
  maxContextChars: 3000,
  maxCarryChars: 1200,
  maxHops: 3,
} as const
