import type { EmailBlock } from './blocks'
import { extractVariables } from './variables'

export interface Translatable {
  subject: string
  preheader: string
  blocks: EmailBlock[]
}

type Slot = { kind: 'subject' } | { kind: 'preheader' } | { kind: 'block'; index: number; field: string }

const FIELDS: Partial<Record<EmailBlock['type'], readonly string[]>> = {
  heading: ['eyebrow', 'text'], paragraph: ['text'], button: ['label'], code: ['label'], note: ['title', 'text'], image: ['alt'], footer: ['text'],
}

function slots(t: Translatable): Array<{ slot: Slot; value: string }> {
  const out: Array<{ slot: Slot; value: string }> = []
  if (t.subject) out.push({ slot: { kind: 'subject' }, value: t.subject })
  if (t.preheader) out.push({ slot: { kind: 'preheader' }, value: t.preheader })
  t.blocks.forEach((b, index) => {
    for (const field of FIELDS[b.type] ?? []) {
      const value = (b as unknown as Record<string, string>)[field]
      if (value) out.push({ slot: { kind: 'block', index, field }, value })
    }
  })
  return out
}

/** Every piece of readable text, in a fixed order, for the translator. URLs, codes and image sources stay out. */
export const collectStrings = (t: Translatable): string[] => slots(t).map((s) => s.value)

export function applyStrings(t: Translatable, strings: readonly string[]): Translatable {
  const next: Translatable = { subject: t.subject, preheader: t.preheader, blocks: t.blocks.map((b) => ({ ...b })) }
  slots(t).forEach(({ slot }, i) => {
    if (slot.kind === 'subject') next.subject = strings[i]!
    else if (slot.kind === 'preheader') next.preheader = strings[i]!
    else (next.blocks[slot.index] as unknown as Record<string, string>)[slot.field] = strings[i]!
  })
  return next
}

/** A translation is only usable if it keeps every `{{variable}}` of the original, and adds none. */
export function sameVariables(source: string, translated: string): boolean {
  const a = extractVariables(source).sort().join()
  return a === extractVariables(translated).sort().join()
}

export function validateTranslation(source: readonly string[], translated: unknown): translated is string[] {
  return Array.isArray(translated) && translated.length === source.length && translated.every((s, i) => typeof s === 'string' && s.trim() !== '' && sameVariables(source[i]!, s))
}
