import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

const attempts = new Map<string, { count: number; blockedUntil: number }>()
const MAX_ATTEMPTS = 5
const BLOCK_DURATION_MS = 15 * 60 * 1000

function getClientIp(req?: Request): string {
  if (!req) return 'unknown'
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

function isBlocked(ip: string): boolean {
  const record = attempts.get(ip)
  if (!record) return false
  if (Date.now() < record.blockedUntil) return true
  attempts.delete(ip)
  return false
}

function recordFailedAttempt(ip: string): void {
  const record = attempts.get(ip) || { count: 0, blockedUntil: 0 }
  record.count++
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS
  }
  attempts.set(ip, record)
}

function clearAttempts(ip: string): void {
  attempts.delete(ip)
}

/**
 * Constant-time PIN comparison using fixed 64-byte buffers to reduce timing leaks.
 */
function pinsMatch(input: string, expected: string): boolean {
  const pack = (s: string) => {
    const buf = Buffer.alloc(64, 0)
    Buffer.from(s.trim(), 'utf8').copy(buf, 0, 0, 64)
    return buf
  }
  return timingSafeEqual(pack(input), pack(expected))
}

export function verifyAdminPin(pin: unknown, req?: Request): NextResponse | null {
  const adminPin = process.env.ADMIN_PIN?.trim()

  if (!adminPin) {
    return NextResponse.json(
      { error: 'Admin PIN not configured on server' },
      { status: 503 }
    )
  }

  const ip = getClientIp(req)

  if (isBlocked(ip)) {
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in 15 minutes.' },
      { status: 429 }
    )
  }

  if (typeof pin !== 'string' || !pinsMatch(pin, adminPin)) {
    recordFailedAttempt(ip)
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  clearAttempts(ip)
  return null
}
