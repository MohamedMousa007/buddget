import { create } from 'zustand'
import { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'

export type PromptTone = 'brand' | 'positive' | 'warning'

export interface PromptAction {
  /** ≤ 16 characters — the CTA row is always one line. */
  label: string
  variant: 'default' | 'success' | 'secondary'
  onPress: () => void
}

/** One card in the drop-down prompt stack. */
export interface Prompt {
  /** Snooze/dismiss key, e.g. `sms-review`, `pm:5521`, `late:<source>@<date>`. */
  key: string
  /** Lower sorts first: late payday → income match → SMS → account → subscription. */
  priority: number
  tone: PromptTone
  icon: LucideIcon
  title: string
  description?: string
  actions: PromptAction[]
}

export const PROMPT_PRIORITY = { late: 10, match: 20, sms: 30, account: 40, subscription: 50, planChange: 60 } as const

interface PromptState {
  /** Prompts by registering source. Only data lives here; callbacks are read fresh from `latest`. */
  bySource: Record<string, Prompt[]>
  set: (source: string, prompts: Prompt[]) => void
  remove: (source: string) => void
}

export const usePromptStore = create<PromptState>((set) => ({
  bySource: {},
  set: (source, prompts) => set((s) => ({ bySource: { ...s.bySource, [source]: prompts } })),
  remove: (source) =>
    set((s) => {
      if (!(source in s.bySource)) return s
      const next = { ...s.bySource }
      delete next[source]
      return { bySource: next }
    }),
}))

/** Latest render's prompts per source, so a CTA never runs a stale closure. */
const latest = new Map<string, Prompt[]>()

/** The freshest version of a registered prompt — what a CTA press should act on. */
export function freshPrompt(key: string): Prompt | undefined {
  for (const list of latest.values()) {
    const hit = list.find((p) => p.key === key)
    if (hit) return hit
  }
  return undefined
}

/**
 * Puts `prompts` into the stack for as long as the caller is mounted. The store only
 * updates when what the card shows changes, so re-renders with new callbacks are free.
 */
export function useRegisterPrompts(source: string, prompts: Prompt[]) {
  const sig = prompts
    .map((p) => [p.key, p.priority, p.tone, p.title, p.description ?? '', p.actions.map((a) => `${a.variant}:${a.label}`).join('|')].join('¦'))
    .join('§')
  // Every commit refreshes the callbacks; the store below only moves when `sig` does.
  useEffect(() => {
    latest.set(source, prompts)
  })
  useEffect(() => {
    usePromptStore.getState().set(source, latest.get(source) ?? [])
  }, [source, sig])
  useEffect(
    () => () => {
      latest.delete(source)
      usePromptStore.getState().remove(source)
    },
    [source],
  )
}
