const RULES = new Intl.PluralRules('ar')

interface ArForms {
  /** Singular noun, used for 1 ("يوم واحد"). */
  one: string
  /** Dual (oblique "ين" form, the one used after prepositions), used for 2 and shown without a number. */
  two: string
  /** Plural, used for 3-10 (and the "few" class). */
  few: string
  /** Singular accusative, used for 11-99 ("11 يومًا"). */
  many: string
  /** Feminine nouns take "واحدة". */
  fem?: boolean
}

/** Picks the Arabic noun form for a count and attaches the number: 0 → "0 أيام", 1 → "يوم واحد", 2 → "يومين", 5 → "5 أيام", 11 → "11 يومًا", 100-102 → singular ("101 يوم"). Negatives use the absolute value for the form. */
export function arPlural(n: number, f: ArForms): string {
  const cat = RULES.select(Math.abs(n))
  if (cat === 'other' && Number.isInteger(n)) return `${n} ${f.one}`
  if (cat === 'one') return `${f.one} ${f.fem ? 'واحدة' : 'واحد'}`
  if (cat === 'two') return f.two
  if (cat === 'few') return `${n} ${f.few}`
  if (cat === 'many') return `${n} ${f.many}`
  return `${n} ${f.few}`
}

export const AR_UNITS = {
  day: { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يومًا' },
  month: { one: 'شهر', two: 'شهرين', few: 'أشهر', many: 'شهرًا' },
  quarter: { one: 'ربع', two: 'ربعين', few: 'أرباع', many: 'ربعًا' },
  source: { one: 'مصدر', two: 'مصدرين', few: 'مصادر', many: 'مصدرًا' },
  debt: { one: 'دين', two: 'دينين', few: 'ديون', many: 'دينًا' },
  payment: { one: 'دفعة', two: 'دفعتين', few: 'دفعات', many: 'دفعة', fem: true },
  message: { one: 'رسالة', two: 'رسالتين', few: 'رسائل', many: 'رسالة', fem: true },
  time: { one: 'مرة', two: 'مرتين', few: 'مرات', many: 'مرة', fem: true },
  week: { one: 'أسبوع', two: 'أسبوعين', few: 'أسابيع', many: 'أسبوعًا' },
  account: { one: 'حساب', two: 'حسابين', few: 'حسابات', many: 'حسابًا' },
  card: { one: 'بطاقة', two: 'بطاقتين', few: 'بطاقات', many: 'بطاقة', fem: true },
  entry: { one: 'قيد', two: 'قيدين', few: 'قيود', many: 'قيدًا' },
  transaction: { one: 'معاملة', two: 'معاملتين', few: 'معاملات', many: 'معاملة', fem: true },
  expense: { one: 'مصروف', two: 'مصروفين', few: 'مصروفات', many: 'مصروفًا' },
  change: { one: 'تغيير', two: 'تغييرين', few: 'تغييرات', many: 'تغييرًا' },
  item: { one: 'عنصر', two: 'عنصرين', few: 'عناصر', many: 'عنصرًا' },
  line: { one: 'بند', two: 'بندين', few: 'بنود', many: 'بندًا' },
  recording: { one: 'تسجيل', two: 'تسجيلين', few: 'تسجيلات', many: 'تسجيلًا' },
  milestone: { one: 'محطة', two: 'محطتين', few: 'محطات', many: 'محطة', fem: true },
  result: { one: 'نتيجة', two: 'نتيجتين', few: 'نتائج', many: 'نتيجة', fem: true },
  bankMessage: { one: 'رسالة بنكية', two: 'رسالتين بنكيتين', few: 'رسائل بنكية', many: 'رسالة بنكية', fem: true },
} as const satisfies Record<string, ArForms>

export type ArUnit = keyof typeof AR_UNITS

export function arCount(n: number, unit: ArUnit): string {
  return arPlural(n, AR_UNITS[unit])
}
