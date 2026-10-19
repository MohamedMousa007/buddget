import { describe, expect, it } from 'vitest'
import { hashPassword, passwordProblem, verifyPassword } from './crypto'

describe('crypto', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('Correct-Horse-9')
    expect(await verifyPassword('Correct-Horse-9', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('enforces a password policy', () => {
    expect(passwordProblem('short1A')).toBeTruthy()
    expect(passwordProblem('alllowercase123456')).toBeTruthy()
    expect(passwordProblem('Good-Password-2026')).toBeNull()
  })
})
