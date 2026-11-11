/**
 * The caller's address for rate-limit buckets. `x-real-ip` is set by the platform itself and the LAST `x-forwarded-for`
 * hop is the one our nearest proxy appended; the first hop is client-supplied, so reading it would let a caller pick
 * a fresh bucket per request wherever the edge does not overwrite the header.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real.slice(0, 64)
  const hops = req.headers.get('x-forwarded-for')?.split(',')
  return hops?.[hops.length - 1]?.trim().slice(0, 64) || 'unknown'
}
