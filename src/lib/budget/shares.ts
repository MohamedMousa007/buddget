/**
 * Percent shares rounded to `decimals` so they add up to the rounded total (largest remainder): three parts of a
 * balanced plan read 100%, never 100.1% or 99.9%.
 */
export function roundedShares(values: readonly number[], whole: number, decimals = 1): number[] {
  if (!(whole > 0)) return values.map(() => 0)
  const unit = 10 ** decimals
  const exact = values.map((v) => (Math.max(0, v) / whole) * 100 * unit)
  const floors = exact.map(Math.floor)
  const target = Math.round(exact.reduce((s, x) => s + x, 0))
  let missing = target - floors.reduce((s, x) => s + x, 0)
  const order = exact.map((x, i) => ({ i, rem: x - floors[i] })).sort((a, b) => b.rem - a.rem)
  for (const { i } of order) {
    if (missing <= 0) break
    floors[i] += 1
    missing -= 1
  }
  return floors.map((f) => f / unit)
}
