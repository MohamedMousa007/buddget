import { describe, expect, it } from 'vitest'
import { resolveBrandKeyFromMerchant } from './subscriptionCatalog'

/**
 * A false brand match is expensive: dispatch force-overrides the category to
 * `Subscription` and links the expense, so a wrong hit miscategorises a real purchase AND
 * corrupts a subscription's payment history.
 */
describe('resolveBrandKeyFromMerchant', () => {
  it.each([
    ['NETFLIX.COM', 'netflix'],
    ['NETFLIX.COM 866-579-7172', 'netflix'],
    ['Netflix', 'netflix'],
    ['Spotify AB', 'spotify'],
    ['OPENAI *CHATGPT', 'chatgpt_plus'],
    ['ANTHROPIC', 'claude_pro'],
    ['OSN PLUS', 'osn_plus'],
    ['osn+', 'osn_plus'],
  ])('resolves %s -> %s', (merchant, key) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBe(key)
  })

  // The regression: `osn` is a 3-char alias, so a bare `includes` matched inside "bosnia".
  // A length>=3 guard alone does NOT fix this — the token is exactly 3.
  it.each([
    ['Bosnia Air', 'a short alias inside a longer word'],
    ['BOSNIAN RESTAURANT', 'the same, upper case'],
    ['Carrefour Egypt', 'an ordinary supermarket'],
    ['LA ROSE PASTRY', 'an ordinary merchant'],
    ['EL Wahat for oil', 'an ordinary merchant'],
    ['ATM Withdrawal', 'a non-purchase description'],
  ])('does not resolve %s (%s)', (merchant) => {
    expect(resolveBrandKeyFromMerchant(merchant)).toBeNull()
  })

  it('does not let a mere fragment of a brand name claim the brand', () => {
    // The old resolver also tried keyToken.includes(norm), so "net" claimed Netflix.
    expect(resolveBrandKeyFromMerchant('net')).toBeNull()
    expect(resolveBrandKeyFromMerchant('Spot')).toBeNull()
  })

  it('prefers the most specific brand when tokens overlap', () => {
    expect(resolveBrandKeyFromMerchant('AMAZON PRIME')).toBe('prime_video')
  })

  it.each([null, undefined, '', '   ', '!!!'])('returns null for %p', (input) => {
    expect(resolveBrandKeyFromMerchant(input)).toBeNull()
  })
})
