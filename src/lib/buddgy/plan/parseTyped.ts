import { extractAmount } from '@/lib/buddgy/local/quickAddAmount'
import { normalizeText } from '@/lib/buddgy/local/text'
import type { FlowNode, FlowValue } from '@/lib/budget/flow/types'
import type { FlowQuestionCopy } from '@/lib/i18n/budgetPage/flowCopy'

const YES = /^(y|yes|yeah|yep|sure|right|correct|ok|okay|true|اه|ايوه|أيوه|ايوا|نعم|اكيد|أكيد|صح|صحيح|تمام|مظبوط)$/iu
const NO = /^(n|no|nope|nah|not really|wrong|false|لا|لأ|مش صح|غلط|خطأ)$/iu

/** Lowercase, Arabic digits as Latin, punctuation as spaces, Arabic letter variants folded to one form. */
const fold = (s: string) =>
  normalizeText(s)
    .toLowerCase()
    .replace(/[.,!?؟،;:'"()]/gu, ' ')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()

function yesNo(text: string): boolean | undefined {
  const t = fold(text)
  if (YES.test(t) || YES.test(text.trim())) return true
  if (NO.test(t) || NO.test(text.trim())) return false
  return undefined
}

function wholeNumber(text: string): number | undefined {
  const m = normalizeText(text).match(/-?\d+/g)
  return m && m.length === 1 ? Number(m[0]) : undefined
}

/** The one option whose label (or value) the reply names: an exact match first, then a unique partial one. */
function option(opts: readonly string[], copy: FlowQuestionCopy, text: string): string | undefined {
  const t = fold(text)
  if (!t) return undefined
  const labels = opts.map((o) => ({ o, l: fold(copy.opts?.[o] ?? o), v: fold(o.replace(/_/g, ' ')) }))
  const exact = labels.filter((x) => x.l === t || x.v === t)
  if (exact.length === 1) return exact[0].o
  if (t.length < 3) return undefined
  const partial = labels.filter((x) => x.l.includes(t) || t.includes(x.l) || x.v === t)
  return partial.length === 1 ? partial[0].o : undefined
}

/**
 * A typed reply to one builder question, read without a model. Undefined means it could not be read, and the question is
 * asked again. Arabic digits and Arabic spelling variants read the same as their plain forms.
 */
export function parseTyped(node: FlowNode, text: string, copy: FlowQuestionCopy): FlowValue | undefined {
  const raw = text.trim()
  if (!raw) return undefined
  switch (node.control) {
    case 'confirm':
    case 'toggle':
      return yesNo(raw)
    case 'amount': {
      if (/^0+$/.test(normalizeText(raw))) return node.id === 'income' ? undefined : 0
      return extractAmount(normalizeText(raw))?.amount
    }
    case 'stepper':
    case 'slider': {
      const n = wholeNumber(raw)
      if (n === undefined || n < (node.min ?? 0) || n > (node.max ?? (node.control === 'slider' ? 100 : Infinity))) return undefined
      return n
    }
    case 'chips':
      return option(node.opts ?? [], copy, raw)
    case 'multi': {
      const parts = raw.split(/\s*(?:,|،|\+|&)\s*|\s+and\s+|\s+و\s*/iu).filter(Boolean)
      const picked = parts.map((p) => option(node.opts ?? [], copy, p))
      if (picked.length === 0 || picked.some((p) => p === undefined)) return undefined
      const unique = [...new Set(picked as string[])]
      return node.max !== undefined && unique.length > node.max ? undefined : unique
    }
  }
}
