import { describe, it, expect } from 'vitest'
import { buildBuddgyMessage, computeBuddgyVariant } from '@/lib/onboarding/buddgyScript'
import type { Dictionary } from '@/lib/i18n/types'

function fakeDict(buddgy: Record<string, Record<string, string>>): Dictionary {
  return {
    onboarding: {
      journey: { buddgy },
    },
  } as unknown as Dictionary
}

describe('buddgyScript · computeBuddgyVariant', () => {
  it('picks the UAE variant for city when country is UAE', () => {
    expect(computeBuddgyVariant('identityCity', { country: 'UAE' })).toBe('uae')
    expect(computeBuddgyVariant('identityCity', { country: 'United Arab Emirates' })).toBe('uae')
  })

  it('picks the Egypt variant for city when country is Egypt', () => {
    expect(computeBuddgyVariant('identityCity', { country: 'Egypt' })).toBe('egypt')
  })

  it('falls back to default when country is unknown', () => {
    expect(computeBuddgyVariant('identityCity', { country: 'Narnia' })).toBe('default')
    expect(computeBuddgyVariant('identityCity', {})).toBe('default')
  })

  it('picks the `remittance` variant for secondary currency in GCC countries', () => {
    expect(computeBuddgyVariant('identitySecondaryCurrency', { country: 'Saudi Arabia' })).toBe(
      'remittance',
    )
  })

  it('returns `default` for cards without a variant picker', () => {
    expect(computeBuddgyVariant('welcomeIntro', {})).toBe('default')
  })
})

describe('buddgyScript · buildBuddgyMessage', () => {
  it('interpolates {name} from answers', () => {
    const t = fakeDict({
      welcomeIntro: { default: "Hey {name}! I'm Buddgy." },
    })
    const msg = buildBuddgyMessage('welcomeIntro', { name: 'Amr' }, t)
    expect(msg).toBe("Hey Amr! I'm Buddgy.")
  })

  it('picks the right country variant and interpolates', () => {
    const t = fakeDict({
      identityCity: {
        uae: 'Which part of UAE, {name}?',
        egypt: 'Which part of Egypt, {name}?',
        default: 'Which city, {name}?',
      },
    })
    expect(buildBuddgyMessage('identityCity', { country: 'UAE', name: 'Amr' }, t)).toBe(
      'Which part of UAE, Amr?',
    )
    expect(buildBuddgyMessage('identityCity', { country: 'Egypt', name: 'Layla' }, t)).toBe(
      'Which part of Egypt, Layla?',
    )
    expect(buildBuddgyMessage('identityCity', { country: 'Kenya', name: 'Zuri' }, t)).toBe(
      'Which city, Zuri?',
    )
  })

  it('drops missing slots silently and cleans up whitespace', () => {
    const t = fakeDict({
      welcomeIntro: { default: 'Hey {name}, welcome!' },
    })
    const msg = buildBuddgyMessage('welcomeIntro', {}, t)
    // "{name}" drops to "", leaving "Hey , welcome!" — the cleanup
    // collapses the stray space before the comma.
    expect(msg).toBe('Hey, welcome!')
  })

  it('falls back to default when a variant key is missing', () => {
    const t = fakeDict({
      identityCity: {
        // no uae, only default
        default: 'Which city, {name}?',
      },
    })
    const msg = buildBuddgyMessage('identityCity', { country: 'UAE', name: 'Amr' }, t)
    expect(msg).toBe('Which city, Amr?')
  })

  it('returns empty string for an unknown card', () => {
    const t = fakeDict({})
    expect(buildBuddgyMessage('welcomeIntro', { name: 'Amr' }, t)).toBe('')
  })
})
