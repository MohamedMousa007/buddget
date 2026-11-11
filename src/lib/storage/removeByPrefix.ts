/** Removes every localStorage key that starts with one of the prefixes (per-user caches keyed `<prefix><userId>`). */
export function removeKeysWithPrefix(prefixes: readonly string[], storage: Pick<Storage, 'length' | 'key' | 'removeItem'>): void {
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const k = storage.key(i)
      if (k && prefixes.some((p) => k.startsWith(p))) storage.removeItem(k)
    }
  } catch {
    /* restricted storage */
  }
}

/** Today's net-worth "already written" stamps; dropped when the account's data is reset so the next visit writes the point again. */
export const NET_WORTH_STAMP_PREFIX = 'bdg-nw:'

export function clearNetWorthStamps(): void {
  if (typeof window !== 'undefined') removeKeysWithPrefix([NET_WORTH_STAMP_PREFIX], window.localStorage)
}
