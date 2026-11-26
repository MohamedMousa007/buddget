/** Moves `id` to index `to` (clamped); the same array back when nothing moves. */
export function moveInOrder(order: readonly string[], id: string, to: number): readonly string[] {
  const from = order.indexOf(id)
  if (from < 0) return order
  const at = Math.max(0, Math.min(order.length - 1, to))
  if (from === at) return order
  const next = [...order]
  next.splice(from, 1)
  next.splice(at, 0, id)
  return next
}

/** The `sortOrder` writes a finished reorder needs: only the paydays whose position changed. */
export function sortOrderPatches(order: readonly string[], current: readonly { id: string; sortOrder?: number }[]): { id: string; sortOrder: number }[] {
  const byId = new Map(current.map((s) => [s.id, s.sortOrder]))
  return order.flatMap((id, i) => (byId.has(id) && byId.get(id) !== i ? [{ id, sortOrder: i }] : []))
}
