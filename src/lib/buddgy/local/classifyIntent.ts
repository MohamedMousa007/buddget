import type { BuddgyIntent } from '@/lib/buddgy/protocol'
import { normalizeText, wordIndex, wordRe } from './text'

const ADVICE = wordRe(
  'plan|planning|strategy|rebuild|payoff|pay off|emergency fund|save for|invest|investing|investment|should i|' +
    'advice|advise|optimi[sz]e|compare|worth it|can i afford|better to|' +
    '(?:build|create|make|design|set up|draft) (?:me )?(?:a |my )?budget|budget (?:plan|planning)|' +
    'how (?:can|do|should|could) i (?:save|cut|reduce|stop|improve|spend less|budget|get out)|' +
    'why (?:am i|do i|is my)[a-z ]* (?:overspend\\w*|spending so much|broke|always short)|' +
    'خطة|انصحني|نصيحة|استثمر|استثمار|هل (?:اشتري|ينفع|يفضل)|ينفع|' +
    '(?:اعمل|انشئ|اعملي) ميزانية|ازاي (?:اوفر|ادخر|اقلل)|كيف (?:اوفر|ادخر|اقلل)|ليه (?:بصرف|فلوسي)|لماذا (?:اصرف|انفق)',
)

const ACTION_START = wordRe(
  'add|log|record|spent|paid|pay|delete|remove|change|update|edit|set|cancel|transfer|create|rename|move|' +
    'اضف|سجل|صرفت|دفعت|احذف|امسح|غير|عدل|الغي|حول|انشئ|ضيف|شيل',
)
const POLITE_PREFIX = /^(?:(?:please|pls|can you|could you|would you|i want to|i wanna|i need to|لو سمحت|من فضلك|ممكن|عايز|عاوز|اريد)\s+)+/iu
const QUESTION_START = wordRe('how|what|when|where|why|which|who|is|are|do|does|did|can|كم|كام|ايه|متى|امتى|ليه|لماذا|هل|فين|ازاي')
const SPENT_ANYWHERE = wordRe('i spent|i paid|spent|paid|صرفت|دفعت')

const wordIndex0 = (re: RegExp, text: string) => {
  const m = text.match(re)
  return m !== null && wordIndex(m) === 0
}

export function classifyIntent(text: string): BuddgyIntent {
  const clean = normalizeText(text)
  if (ADVICE.test(clean)) return 'advice'
  const body = clean.replace(POLITE_PREFIX, '')
  const startsWithVerb = wordIndex0(ACTION_START, body)
  if (startsWithVerb) return 'action'
  const isQuestion = /[?؟]/.test(clean) || wordIndex0(QUESTION_START, body)
  if (isQuestion) return 'answer'
  if (SPENT_ANYWHERE.test(clean) || /\d/.test(clean)) return 'action'
  return 'answer'
}
