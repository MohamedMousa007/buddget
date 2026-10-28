export type TicketKind = 'support' | 'bug' | 'feature' | 'billing' | 'account' | 'praise' | 'other'
export type Severity = 'low' | 'normal' | 'high' | 'critical'
export type Chosen = 'bug' | 'idea' | 'question'

export interface Triage {
  kind: TicketKind
  area: string | null
  severity: Severity
  /** 'needs_human' lands in the triage queue; 'auto_triaged' is routed without a person. */
  state: 'auto_triaged' | 'needs_human'
  confidence: number
  /** Bugs go to Linear on their own once we are reasonably sure they are bugs, or whenever they look serious. */
  toLinear: boolean
}

const AUTO_THRESHOLD = 0.7

const KIND_WORDS: Array<[TicketKind, RegExp]> = [
  ['billing', /\b(charge[ds]?|refund|invoice|billing|payment failed|subscription (fee|price)|paid twice)\b|استرداد|فاتورة|خصم مرتين/i],
  ['account', /\b(log ?in|sign ?in|password|locked out|verify (my )?email|delete (my )?account|two[- ]factor|2fa)\b|تسجيل الدخول|كلمة المرور|حذف حسابي/i],
]

const AREA_WORDS: Array<[string, RegExp]> = [
  ['sms', /\b(sms|bank (text|message)|shortcut|text messages?)\b|رسالة|رسائل/i],
  ['sync', /\b(sync|syncing|data (is )?(missing|gone|lost)|lost (my )?data|another device)\b|مزامنة|اختفت/i],
  ['budget', /\b(budget|plan|category|cap)\b|ميزانية/i],
  ['accounts', /\b(account balance|balance|wallet|bank account|cash)\b|رصيد|محفظة/i],
  ['debts', /\b(debt|loan|installment|credit card)\b|دين|قرض|قسط/i],
  ['goals', /\b(goal|saving|pocket)\b|هدف|ادخار/i],
  ['ai', /\b(buddgy|assistant|chat|voice)\b|بادجي/i],
  ['notifications', /\b(notification|push|reminder)\b|إشعار/i],
  ['security', /\b(face id|biometric|fingerprint|lock)\b|بصمة/i],
  ['onboarding', /\b(set ?up|onboarding|getting started)\b|إعداد/i],
]

const CRITICAL = /\b(crash(es|ed|ing)?|can'?t open|cannot open|won'?t open|blank screen|lost (all )?my data|data (is )?gone|stuck)\b|يتعطل|انهار|اختفت بياناتي/i
const HIGH = /\b(wrong balance|duplicate[ds]?|missing money|not working|doesn'?t work|error|failed)\b|خطأ|لا يعمل/i

const FROM_CHOICE: Record<Chosen, TicketKind> = { bug: 'bug', idea: 'feature', question: 'support' }

/**
 * Rule-based triage: trust what the person chose, adjust it when the words clearly say otherwise, and say how sure we are.
 * Cheap, deterministic and explainable; a model can sit behind it later for the unsure cases.
 */
export function triage({ chosen, title, body }: { chosen: Chosen; title: string; body: string }): Triage {
  const text = `${title}\n${body}`
  const area = AREA_WORDS.find(([, re]) => re.test(text))?.[0] ?? null
  const hinted = KIND_WORDS.find(([, re]) => re.test(text))?.[0] ?? null

  // A question about billing or login is billing or account; a bug report stays a bug whatever words it uses.
  const kind: TicketKind = chosen === 'question' && hinted ? hinted : FROM_CHOICE[chosen]
  const overridden = kind !== FROM_CHOICE[chosen]

  let severity: Severity = 'normal'
  if (kind === 'feature') severity = 'low'
  else if (CRITICAL.test(text)) severity = 'critical'
  else if (HIGH.test(text)) severity = 'high'

  let confidence = 0.9
  if (overridden) confidence = 0.75
  if (!area && text.trim().length < 40) confidence = Math.min(confidence, 0.5)
  else if (!area && kind !== 'feature') confidence = Math.min(confidence, 0.65)

  const state = confidence >= AUTO_THRESHOLD ? 'auto_triaged' : 'needs_human'
  return { kind, area, severity, state, confidence, toLinear: kind === 'bug' && (state === 'auto_triaged' || severity === 'high' || severity === 'critical') }
}
