import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { namesOwnWallet } from './pairing'

/**
 * Loading your own wallet books 2 SAR of spend AND 2 SAR of income today: the funding
 * card's bank reports "Online Purchase ... From: barq" and Barq reports "Money Added to
 * your Barq wallet". Both legs are the same own money, so both must reach step 2's
 * pairing and collapse to one non-spend row.
 *
 * A wallet has no last4, so the wallet's NAME is the only thing tying the two legs to a
 * registered payment method — which makes this matcher the whole basis of that decision.
 */
function stubService(wallets: Array<{ name: string }>): SupabaseClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    is: () => Promise.resolve({ data: wallets }),
  }
  return { from: () => chain } as unknown as SupabaseClient
}

const barq = stubService([{ name: 'Barq' }])

describe('namesOwnWallet', () => {
  it("matches the wallet's own credit SMS (the inbound leg)", async () => {
    const body = 'Money Added to your Barq wallet\namount: 13.0 SAR\nvia: Apple pay\ncard number: **9379'
    expect(await namesOwnWallet(barq, 'u1', body)).toBe(true)
  })

  it('matches the funding bank\'s merchant field (the outbound leg)', async () => {
    expect(await namesOwnWallet(barq, 'u1', 'barq')).toBe(true)
  })

  it('does not match a longer word that merely contains the name', async () => {
    // Reclassifying a real purchase as a transfer would silently erase it from spend.
    expect(await namesOwnWallet(barq, 'u1', 'POS Purchase at Barqawi Restaurant')).toBe(false)
  })

  it('ignores names too short to match safely', async () => {
    const shortName = stubService([{ name: 'Q' }])
    expect(await namesOwnWallet(shortName, 'u1', 'Online Purchase Q8 fuel station')).toBe(false)
  })

  it('is false when the user has registered no wallet', async () => {
    expect(await namesOwnWallet(stubService([]), 'u1', 'Money Added to your Barq wallet')).toBe(false)
  })

  it('does not treat regex metacharacters in a wallet name as a pattern', async () => {
    const odd = stubService([{ name: 'Pay.Me' }])
    expect(await namesOwnWallet(odd, 'u1', 'Money added to PayXMe')).toBe(false)
    expect(await namesOwnWallet(odd, 'u1', 'Money added to Pay.Me')).toBe(true)
  })
})
