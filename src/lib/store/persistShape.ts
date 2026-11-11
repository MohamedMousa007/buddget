const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Drops persisted fields whose container type differs from the default (null/string where an array or object lives), so the default stays. */
export function dropMistypedFields<T extends object>(persisted: Partial<T>, defaults: T): Partial<T> {
  const out: Record<string, unknown> = { ...persisted }
  const base = defaults as Record<string, unknown>
  for (const k of Object.keys(out)) {
    const d = base[k]
    if (Array.isArray(d) ? !Array.isArray(out[k]) : isObject(d) && !isObject(out[k])) delete out[k]
  }
  return out as Partial<T>
}
