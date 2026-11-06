import { describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ active: false }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/clientGate', () => ({ gateOutdatedClient: async () => null }))
vi.mock('@/lib/supabase/env', () => ({ isSupabaseConfigured: () => true }))
vi.mock('@/lib/supabase/resolveRouteUser', () => ({ resolveRouteIdentity: async () => ({ id: 'u1', email: null, amr: [], sessionId: null }) }))
vi.mock('@/lib/auth/accountActive', () => ({ isAccountActive: async () => h.active }))

import { POST as aiLegacy } from '@/app/api/ai/route'
import { POST as buddgyTurn } from '@/app/api/buddgy/turn/route'
import { POST as budgetAi } from '@/app/api/budget/ai/route'
import { POST as receiptScan } from '@/app/api/receipt/scan/route'
import { POST as voice } from '@/app/api/voice/transcribe/route'
import { NextRequest } from 'next/server'

const post = () => new NextRequest('http://x/api', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })

describe('AUT-2: a suspended account is refused by every paid AI route', () => {
  const routes: [string, (r: NextRequest) => Promise<Response>][] = [
    ['ai', aiLegacy], ['buddgy/turn', buddgyTurn], ['budget/ai', budgetAi], ['receipt/scan', receiptScan], ['voice/transcribe', voice],
  ]
  it.each(routes)('%s answers 401', async (_name, handler) => {
    h.active = false
    expect((await handler(post())).status).toBe(401)
  })

  it.each(routes)('%s lets an active account past the auth check', async (_name, handler) => {
    h.active = true
    expect((await handler(post())).status).not.toBe(401)
  })
})
