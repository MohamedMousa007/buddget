/** Radio-group arrow navigation: the index a key moves to, wrapping at both ends; null for any other key. */
export function nextSegmentIndex(key: string, current: number, count: number): number | null {
  if (current < 0 || count === 0) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % count
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
