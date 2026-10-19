import { foldArabic, normalizeText } from './text'

export type LocalAnswerId = 'spent_month' | 'left_to_spend' | 'next_payday' | 'top_category' | 'safe_daily'

export interface LocalQuestionMatch {
  id: LocalAnswerId
  read: { tool: string; args: Record<string, unknown> }
}

const MONTH = '(?:this month|the month|so far|in total|thus far|this month so far|so far this month)'
const AR_MONTH = '(?:(?:هذا |هدا )?الشهر(?: ده| دا| هذا| الحالي)?|هالشهر|لحد دلوقتي|لحد الان|حتي الان|حتي الحين)'

const PATTERNS: Record<'en' | 'ar', [LocalAnswerId, string[]][]> = {
  en: [
    [
      'spent_month',
      [
        `how much (?:have i |did i |do i |i )?(?:spent|spend)(?: money)?(?: ${MONTH})+`,
        `what (?:have i|did i) (?:spent|spend)(?: ${MONTH})+`,
        `(?:what is |whats )?(?:my |the )?(?:total )?(?:spending|expenses|spend|outgoings)(?: ${MONTH})+`,
        `(?:what is |whats )?my total (?:spending|expenses|spend)`,
      ],
    ],
    [
      'left_to_spend',
      [
        `(?:what is |whats )?(?:my |the )?(?:left to spend|remaining budget|budget left|money left)(?: ${MONTH}| now)?`,
        `how much (?:money )?(?:do i have |have i got |is )?(?:left|remaining)(?: to spend)?(?: ${MONTH}| now)?`,
        `(?:what is |whats )left(?: to spend| in my budget| ${MONTH})?`,
        `how much (?:can|could) i (?:still )?spend (?:this month|for the rest of the month)`,
      ],
    ],
    [
      'safe_daily',
      [
        `how much can i spend (?:per day|a day|each day|daily|today|every day)`,
        `how much (?:can|could) i (?:safely )?spend (?:per|a|each|every) day`,
        `(?:what is |whats )?(?:my )?(?:safe daily(?: amount| spend| spending)?|daily (?:budget|limit|allowance|spend))`,
        `how much per day can i spend`,
      ],
    ],
    [
      'top_category',
      [
        `(?:what is |whats )?my (?:top|biggest|largest|main) (?:spending )?(?:expense )?category(?: ${MONTH})?`,
        `where (?:does|did|is) my money (?:go|going)(?: ${MONTH})?`,
        `what (?:do|did) i spend the most on(?: ${MONTH})?`,
        `which category (?:do|did) i spend the most (?:on|in)(?: ${MONTH})?`,
        `where am i spending the most`,
      ],
    ],
  ],
  ar: [
    [
      'spent_month',
      [
        `كم صرفت ${AR_MONTH}`,
        `كام صرفت ${AR_MONTH}`,
        `صرفت كام ${AR_MONTH}`,
        `كم انفقت ${AR_MONTH}`,
        `(?:اجمالي |مجموع )?(?:مصاريفي|مصروفاتي|مصروفي) ${AR_MONTH}`,
      ],
    ],
    [
      'left_to_spend',
      [
        `كام (?:فاضل|باقي)(?: معايا| لي| عندي| ليا)?(?: ${AR_MONTH})?`,
        `(?:فاضل|باقي) كام(?: معايا| لي| عندي| ليا)?(?: ${AR_MONTH})?`,
        `كم (?:تبقي|المتبقي|باقي)(?: لي| معي| عندي)?(?: ${AR_MONTH})?`,
        `كم (?:المتبقي|الباقي) من ميزانيتي(?: ${AR_MONTH})?`,
      ],
    ],
    [
      'safe_daily',
      [
        `(?:اصرف|اقدر اصرف|استطيع ان اصرف|اصرف كام) كام (?:في اليوم|يوميا|النهاردة|اليوم)`,
        `كام اقدر اصرف (?:في اليوم|يوميا|النهاردة|اليوم)`,
        `كم (?:اقدر|يمكنني) (?:ان )?(?:اصرف|انفق) (?:في اليوم|يوميا|اليوم)`,
        `ميزانيتي (?:اليومية|يوميا)`,
        `(?:المصروف|الميزانية) اليومي(?:ة)?`,
      ],
    ],
    [
      'top_category',
      [
        `اكتر (?:حاجة|فئة|تصنيف|بند) صرفت (?:عليها|عليه|فيها)(?: ${AR_MONTH})?`,
        `اكثر (?:فئة|تصنيف|بند) صرفت (?:عليها|عليه|فيها)(?: ${AR_MONTH})?`,
        `فلوسي بتروح فين(?: ${AR_MONTH})?`,
        `اين تذهب (?:اموالي|فلوسي)(?: ${AR_MONTH})?`,
        `اكبر (?:فئة|تصنيف) (?:مصروفات|صرف)(?: ${AR_MONTH})?`,
      ],
    ],
  ],
}

const COMPILED = (Object.keys(PATTERNS) as ('en' | 'ar')[]).reduce(
  (acc, locale) => {
    acc[locale] = PATTERNS[locale].map(([id, sources]) => [
      id,
      new RegExp(`^(?:${sources.map((s) => (locale === 'ar' ? foldArabic(s) : s)).join('|')})$`, 'iu'),
    ])
    return acc
  },
  {} as Record<'en' | 'ar', [LocalAnswerId, RegExp][]>,
)

function canonical(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[?؟!.,،]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchLocalQuestion(text: string, locale: 'en' | 'ar'): LocalQuestionMatch | null {
  const q = canonical(text)
  if (!q) return null
  const lists = [COMPILED[locale], COMPILED[locale === 'en' ? 'ar' : 'en']]
  for (const list of lists) {
    const hit = list.find(([, re]) => re.test(q))
    if (hit) return { id: hit[0], read: { tool: 'get_summary', args: {} } }
  }
  return null
}

const money = (n: number, currency: string) => `${n.toLocaleString('en-US')} ${currency}`
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function formatLocalAnswer(
  id: LocalAnswerId,
  result: Record<string, unknown>,
  locale: 'en' | 'ar',
): string | null {
  const { currency, spent, left_to_spend: left, safe_daily: daily, days_left: daysLeft } = result
  const top = Array.isArray(result.top_categories) ? result.top_categories[0] : undefined
  if (typeof currency !== 'string') return null
  const ar = locale === 'ar'

  if (id === 'spent_month') {
    if (!isNum(spent)) return null
    return ar ? `صرفت ${money(spent, currency)} هذا الشهر.` : `You've spent ${money(spent, currency)} this month.`
  }
  if (id === 'left_to_spend') {
    if (!isNum(left) || result.income_declared === false) return null
    if (left < 0) {
      return ar
        ? `تجاوزت ميزانيتك بمقدار ${money(-left, currency)}.`
        : `You're over by ${money(-left, currency)} this month.`
    }
    return ar ? `المتبقي لك ${money(left, currency)} هذا الشهر.` : `You have ${money(left, currency)} left to spend this month.`
  }
  if (id === 'safe_daily') {
    if (!isNum(daily) || !isNum(daysLeft) || result.income_declared === false) return null
    return ar
      ? `يمكنك صرف ${money(daily, currency)} يوميا لمدة ${daysLeft} يوم متبقي.`
      : `You can safely spend ${money(daily, currency)} a day for the next ${daysLeft} days.`
  }
  if (id === 'top_category') {
    const entry = top as { name?: unknown; spent?: unknown } | undefined
    if (typeof entry?.name !== 'string' || !isNum(entry.spent)) return null
    return ar
      ? `أكثر فئة صرفت عليها هذا الشهر هي ${entry.name}: ${money(entry.spent, currency)}.`
      : `Your top category this month is ${entry.name} at ${money(entry.spent, currency)}.`
  }
  return null
}
