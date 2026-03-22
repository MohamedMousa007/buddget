import { NextResponse } from 'next/server'

export function verifyAdminPin(pin: unknown): NextResponse | null {
  const adminPin = process.env.ADMIN_PIN?.trim()

  if (!adminPin) {
    return NextResponse.json(
      { error: 'Admin PIN not configured on server' },
      { status: 503 }
    )
  }

  if (typeof pin !== 'string' || pin.trim() !== adminPin) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  return null
}
