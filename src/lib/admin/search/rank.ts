export interface Searchable {
  title: string
  keywords: readonly string[]
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

const isSubsequence = (needle: string, hay: string): boolean => {
  let i = 0
  for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true
  return false
}

/** True when `a` and `b` differ by at most one insertion, deletion or substitution. */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (i === a.length || i === b.length) return true
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1)
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  return short.slice(i) === long.slice(i + 1)
}

function tokenScore(token: string, title: string, titleWords: string[], keywords: string[]): number {
  if (title === token) return 100
  if (title.startsWith(token)) return 80
  if (titleWords.some((w) => w.startsWith(token))) return 70
  if (title.includes(token)) return 50
  const kwWords = keywords.flatMap((k) => k.split(' '))
  if (keywords.includes(token) || kwWords.includes(token)) return 45
  if (kwWords.some((w) => w.startsWith(token))) return 40
  if (keywords.some((k) => k.includes(token))) return 25
  if (token.length >= 4 && [...titleWords, ...kwWords].some((w) => withinOneEdit(token, w))) return 15
  if (token.length >= 5 && isSubsequence(token, title.replace(/ /g, ''))) return 10
  return 0
}

/** 0 = no match. Every query word must match somewhere; the sum of the best per-word scores ranks. */
export function scoreEntry(entry: Searchable, query: string): number {
  const q = normalize(query)
  if (!q) return 0
  const title = normalize(entry.title)
  const titleWords = title.split(' ')
  const keywords = entry.keywords.map(normalize)
  let total = title.includes(q) ? 20 : 0
  for (const token of q.split(' ')) {
    const s = tokenScore(token, title, titleWords, keywords)
    if (s === 0) return 0
    total += s
  }
  return total
}

/** Matching entries best first; equal scores keep their original order. */
export function rankEntries<T extends Searchable>(entries: readonly T[], query: string, limit = 30): T[] {
  return entries
    .map((entry, order) => ({ entry, order, score: scoreEntry(entry, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((r) => r.entry)
}
