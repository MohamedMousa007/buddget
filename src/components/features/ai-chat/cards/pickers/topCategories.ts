/** The category chips a card offers first: the current one, then the person's most used, up to `n`. */
export function topCategories<T extends { value: string }>(options: readonly T[], used: readonly string[], current: string, n = 5): T[] {
  const count = new Map<string, number>()
  for (const c of used) count.set(c, (count.get(c) ?? 0) + 1)
  const ranked = [...options].sort((a, b) => (count.get(b.value) ?? 0) - (count.get(a.value) ?? 0))
  const first = ranked.find((o) => o.value === current)
  return [...(first ? [first] : []), ...ranked.filter((o) => o !== first)].slice(0, n)
}
