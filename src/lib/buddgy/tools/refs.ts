/**
 * Entities are referenced by the first six characters of their id. A full uuid costs ~20 tokens
 * every time the model reads or writes one; six hex characters cost ~3 and are unique in practice.
 */
export const REF_LENGTH = 6

export const refOf = (id: string): string => id.replace(/-/g, '').slice(0, REF_LENGTH)

export type RefMatch<T> = { kind: 'one'; item: T } | { kind: 'none' } | { kind: 'many'; items: T[] }

export function resolveRef<T extends { id: string }>(items: readonly T[], ref: unknown): RefMatch<T> {
  if (typeof ref !== 'string' || ref.trim() === '') return { kind: 'none' }
  const wanted = ref.trim().toLowerCase().replace(/-/g, '')
  if (wanted.length < 4) return { kind: 'none' }
  const exact = items.filter((i) => i.id.replace(/-/g, '').toLowerCase() === wanted)
  if (exact.length === 1) return { kind: 'one', item: exact[0] }
  const hits = items.filter((i) => i.id.replace(/-/g, '').toLowerCase().startsWith(wanted))
  if (hits.length === 1) return { kind: 'one', item: hits[0] }
  return hits.length === 0 ? { kind: 'none' } : { kind: 'many', items: hits }
}

/**
 * Looks an entity up by ref first, then by exact (case-insensitive) name. Never by substring:
 * a write must not land on a guess.
 */
export function resolveByRefOrName<T extends { id: string }>(
  items: readonly T[],
  value: unknown,
  nameOf: (item: T) => string,
): RefMatch<T> {
  const byRef = resolveRef(items, value)
  if (byRef.kind !== 'none') return byRef
  if (typeof value !== 'string' || value.trim() === '') return { kind: 'none' }
  const name = value.trim().toLowerCase()
  const named = items.filter((i) => nameOf(i).trim().toLowerCase() === name)
  if (named.length === 1) return { kind: 'one', item: named[0] }
  return named.length === 0 ? { kind: 'none' } : { kind: 'many', items: named }
}
