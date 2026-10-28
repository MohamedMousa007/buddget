import { stripAll, wordRe } from './text'

const WEEKDAYS: [number, string][] = [
  [0, 'sunday|الاحد'],
  [1, 'monday|الاثنين|الاتنين|الأثنين'],
  [2, 'tuesday|الثلاثاء|التلات'],
  [3, 'wednesday|الاربعاء|الاربع'],
  [4, 'thursday|الخميس'],
  [5, 'friday|الجمعة'],
  [6, 'saturday|السبت'],
]

const ISO_RE = new RegExp('(?:^|[^\\d-])(?<w>(\\d{4})-(\\d{2})-(\\d{2}))(?![\\d-])', 'g')
const SLASH_RE = new RegExp('(?:^|[^\\d/])(?<w>(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?)(?![\\d/])', 'g')
const DAY_BEFORE_YESTERDAY = wordRe('day before yesterday|اول (?:امس|امبارح)')
const YESTERDAY = wordRe('yesterday|امس|امبارح|البارحة')
const TODAY = wordRe('today|اليوم|النهاردة|النهارده|انهاردة')
const WEEKDAY_PREFIX = '(?:(?:on|last)\\s+)?(?:يوم\\s+)?'

const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`)
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10)

function shift(iso: string, days: number): string {
  return toIso(ms(iso) + days * 86_400_000)
}

function validIso(iso: string): boolean {
  const t = ms(iso)
  return !Number.isNaN(t) && toIso(t) === iso
}

/** Returns null when the text holds conflicting or invalid dates. */
export function extractDate(text: string, today: string): { date?: string; rest: string } | null {
  const found: string[] = []
  let rest = text

  for (const m of rest.matchAll(ISO_RE)) {
    const iso = m.groups!.w
    if (!validIso(iso) || iso > today) return null
    found.push(iso)
  }
  rest = stripAll(rest, ISO_RE)

  for (const m of rest.matchAll(SLASH_RE)) {
    const day = Number(m[2])
    const month = Number(m[3])
    const pad = (n: number) => String(n).padStart(2, '0')
    const explicitYear = m[4] ? (m[4].length === 2 ? 2000 + Number(m[4]) : Number(m[4])) : null
    const todayYear = Number(today.slice(0, 4))
    let iso = `${explicitYear ?? todayYear}-${pad(month)}-${pad(day)}`
    if (!validIso(iso)) return null
    if (iso > today && explicitYear === null) iso = `${todayYear - 1}-${pad(month)}-${pad(day)}`
    if (!validIso(iso) || iso > today) return null
    found.push(iso)
  }
  rest = stripAll(rest, SLASH_RE)

  const relative: [RegExp, number][] = [
    [DAY_BEFORE_YESTERDAY, -2],
    [YESTERDAY, -1],
    [TODAY, 0],
  ]
  for (const [re, offset] of relative) {
    if (re.test(rest)) {
      found.push(shift(today, offset))
      rest = stripAll(rest, re)
    }
  }

  const todayDow = new Date(ms(today)).getUTCDay()
  for (const [dow, names] of WEEKDAYS) {
    const re = wordRe(`${WEEKDAY_PREFIX}(?:${names})`)
    if (re.test(rest)) {
      found.push(shift(today, -(((todayDow - dow + 7) % 7) || 7)))
      rest = stripAll(rest, re)
    }
  }

  if (found.length > 1) return null
  return { date: found[0], rest }
}
