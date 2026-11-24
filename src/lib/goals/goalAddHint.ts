/** Minor-unit dust from FX rounding is not "over" or "left". */
const EPS = 0.005

export type GoalAddHint = { kind: 'left' | 'over'; amount: number } | { kind: 'exact' }

/**
 * What a deposit does to a goal, shown before saving. Display only: the deposit is never capped, since a goal's
 * progress is its pockets' balances (FX, gold and deposits made elsewhere move them too).
 */
export function goalAddHint(current: number, target: number | null | undefined, add: number): GoalAddHint | null {
  if (!(target != null && target > 0) || !(add > 0) || !Number.isFinite(current)) return null
  const after = current + add
  if (Math.abs(after - target) < EPS) return { kind: 'exact' }
  return after < target ? { kind: 'left', amount: target - after } : { kind: 'over', amount: after - target }
}
