/**
 * Rows this device brought back with Undo. A delete can only be undone by an action newer than the delete, so an undo
 * can lose to a later delete made elsewhere: when a pull then reports one of these ids deleted, the user is told.
 */
const restored = new Set<string>()
const MAX_WATCHED = 200

export function noteRestored(id: string): void {
  if (restored.size >= MAX_WATCHED) restored.delete(restored.values().next().value as string)
  restored.add(id)
}

/** The watched ids among `deletedIds`; each is reported once. */
export function refusedUndos(deletedIds: Iterable<string>): string[] {
  const out: string[] = []
  for (const id of deletedIds) if (restored.delete(id)) out.push(id)
  return out
}
