export function monthNameInZone(now: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone }).format(now)
}
