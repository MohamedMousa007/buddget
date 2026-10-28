/** Sorts items by a display label using the UI language's collation (Arabic alphabet order in `ar`). Returns a new array. */
export function sortByLabel<T>(items: readonly T[], label: (item: T) => string, locale: string): T[] {
  const collator = new Intl.Collator(locale === 'ar' ? 'ar-EG' : locale)
  return [...items].sort((a, b) => collator.compare(label(a), label(b)))
}
