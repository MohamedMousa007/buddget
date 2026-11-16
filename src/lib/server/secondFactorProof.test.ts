import { describe, expect, it } from 'vitest'
import { PROOF_TTL_MS, mintProof, verifyProof } from './secondFactorProof'

const NOW = 1_800_000_000_000
describe('second-factor proof cookie', () => {
  const proof = mintProof('secret', 's1', 'u1', NOW)!
  it('verifies for the same session and user within the window', () => {
    expect(verifyProof('secret', proof, 's1', 'u1', NOW + 1000)).toBe(true)
  })
  it('rejects another session, another user, another secret, an expired or tampered value', () => {
    expect(verifyProof('secret', proof, 's2', 'u1', NOW)).toBe(false)
    expect(verifyProof('secret', proof, 's1', 'u2', NOW)).toBe(false)
    expect(verifyProof('other', proof, 's1', 'u1', NOW)).toBe(false)
    expect(verifyProof('secret', proof, 's1', 'u1', NOW + PROOF_TTL_MS + 1)).toBe(false)
    const [exp, sig] = proof.split('.')
    expect(verifyProof('secret', `${Number(exp) + 60_000_000}.${sig}`, 's1', 'u1', NOW)).toBe(false)
    expect(verifyProof('secret', `${exp}.${sig.slice(0, -1)}0`, 's1', 'u1', NOW)).toBe(false)
  })
  it('does nothing without a secret or a value', () => {
    expect(mintProof(undefined, 's1', 'u1')).toBeNull()
    expect(verifyProof('secret', undefined, 's1', 'u1')).toBe(false)
    expect(verifyProof(undefined, proof, 's1', 'u1')).toBe(false)
  })
})
