import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { getFirebaseAdmin } from '@/lib/server/firebaseAdmin'

export async function GET(req: Request) {
  const pin = req.headers.get('x-admin-pin') ?? ''
  const authError = verifyAdminPin(pin, req)
  if (authError) return authError

  const configured = getFirebaseAdmin() !== null
  return NextResponse.json({ configured })
}
