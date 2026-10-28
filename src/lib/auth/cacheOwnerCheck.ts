/** True when the persisted cache demonstrably belongs to a different account than the one signed in. */
export function cacheOwnerMismatch(ownerId: string | null | undefined, userId: string): boolean {
  return !!ownerId && ownerId !== 'local' && ownerId !== userId
}
