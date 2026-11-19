import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setPasswordUpdatedHint, takePasswordUpdatedHint } from './passwordUpdatedHint'

beforeEach(() => {
  const m = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) })
})

describe('password-updated hint (QA-83)', () => {
  it('is absent on an ordinary load, present once after a reset, then consumed', () => {
    expect(takePasswordUpdatedHint()).toBe(false)
    setPasswordUpdatedHint()
    expect(takePasswordUpdatedHint()).toBe(true)
    expect(takePasswordUpdatedHint()).toBe(false)
  })
})

describe('public pages make no unrelated API calls (QA-83)', () => {
  const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8')
  it('the cookie sync asks the server only when the hint is set', () => {
    expect(read('components/auth/AuthProvider.tsx')).toMatch(/if \(!takePasswordUpdatedHint\(\)\) return/)
  })
  it('the Buddgy orb checks AI status only for a signed-in user', () => {
    const src = read('components/ai/AIChatBubble.tsx')
    expect(src).toMatch(/if \(!signedIn\) return\s+checkAIStatus\(\)/)
  })
})
