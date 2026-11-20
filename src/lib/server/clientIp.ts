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

/**
 * The rate-limit key for an address: IPv4 whole, IPv6 by its /64, because one IPv6 host controls a whole /64 and can
 * take a fresh address per request (S8A X-3).
 */
export function rateBucketIp(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped) return mapped[1]!
  if (!ip.includes(':')) return ip
  const [head = '', tail = ''] = ip.toLowerCase().split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`
}
