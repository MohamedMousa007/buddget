import { describe, expect, it } from 'vitest'
import { MAX_FAILED_ATTEMPTS, recordFailure, type CredentialRow } from './credentials'

function fakeService(row: CredentialRow) {
  const state = { row: { ...row } }
  const service = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...state.row } }) }) }),
      update: (patch: Partial<CredentialRow>) => ({
        eq: () => ({
          eq: (_c: string, expected: number) => ({
            select: async () => {
              if (state.row.failed_attempts !== expected) return { data: [] }
              state.row = { ...state.row, ...patch }
              return { data: [{ user_id: state.row.user_id }] }
            },
          }),
        }),
      }),
    }),
  }
  return { service: service as never, state }
}

const base: CredentialRow = { user_id: 'u', password_hash: 'h', setup_completed_at: 'x', sso_enabled: false, failed_attempts: 0, locked_until: null }

describe('recordFailure', () => {
  it('counts parallel guesses from the same stale read, locking at the limit', async () => {
    const { service, state } = fakeService(base)
    const results = await Promise.all(Array.from({ length: MAX_FAILED_ATTEMPTS }, () => recordFailure(service, base)))
    expect(results.some((r) => r.locked)).toBe(true)
    expect(state.row.locked_until).not.toBeNull()
    expect(state.row.failed_attempts).toBe(0)
  })

  it('counts a single failure', async () => {
    const { service, state } = fakeService(base)
    expect(await recordFailure(service, base)).toEqual({ locked: false })
    expect(state.row.failed_attempts).toBe(1)
  })
})
