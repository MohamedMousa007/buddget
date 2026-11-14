import { describe, expect, it } from 'vitest'
import type { ServiceClient } from '@/lib/supabase/service'
import { isKnownNonTransaction } from './negativeCache'
import { coarseShapeKey, maskSkeletonText, smsSkeleton } from './skeleton'

// Synthetic messages only.
const PROMO = 'Enjoy 20% off at selected stores this weekend with your card. Terms apply.'

function svc(opts: { rejected: number; parsed: number; fail?: boolean; seen?: (shape: unknown) => void }) {
  const from = () => {
    const eqs: Record<string, unknown> = {}
    const c: Record<string, unknown> = {
      select: () => c,
      in: () => c,
      eq: (col: string, v: unknown) => { eqs[col] = v; return c },
      limit: () => {
        if (opts.fail) return Promise.reject(new Error('down'))
        opts.seen?.(eqs.masked_body)
        const n = eqs.parsed_ok === true ? opts.parsed : opts.rejected
        return Promise.resolve({ data: Array.from({ length: n }, (_, i) => ({ id: String(i) })), error: null })
      },
    }
    return c
  }
  return { from } as unknown as ServiceClient
}

describe('isKnownNonTransaction', () => {
  it('skips the AI once the same shape was rejected twice and never parsed', async () => {
    expect(await isKnownNonTransaction(svc({ rejected: 2, parsed: 0 }), PROMO)).toBe(true)
  })

  it('still asks the AI after a single rejection', async () => {
    expect(await isKnownNonTransaction(svc({ rejected: 1, parsed: 0 }), PROMO)).toBe(false)
  })

  it('never trusts rejections for a shape that has parsed as a transaction', async () => {
    expect(await isKnownNonTransaction(svc({ rejected: 5, parsed: 1 }), PROMO)).toBe(false)
  })

  it('looks the shape up masked, so the same promotion with other numbers is the same shape', async () => {
    const shapes: unknown[] = []
    await isKnownNonTransaction(svc({ rejected: 2, parsed: 0, seen: (s) => shapes.push(s) }), PROMO)
    await isKnownNonTransaction(svc({ rejected: 2, parsed: 0, seen: (s) => shapes.push(s) }), PROMO.replace('20%', '35%'))
    expect(new Set(shapes)).toEqual(new Set([maskSkeletonText(PROMO)]))
  })

  it('fails open when the lookup fails or the message is too short to have a shape', async () => {
    expect(await isKnownNonTransaction(svc({ rejected: 2, parsed: 0, fail: true }), PROMO)).toBe(false)
    expect(await isKnownNonTransaction(svc({ rejected: 2, parsed: 0 }), 'ok')).toBe(false)
  })
})

describe('coarseShapeKey', () => {
  const a = 'Purchase of EGP 1,250.50 at KAZYON on card ****1234 on 12/11/2026 14:05. Available balance EGP 9,000.00'
  const b = 'Purchase of EGP 75 at SOMESHOP on card ****9876 on 03/01/2026 09:41. Available balance EGP 120.10'

  it('is the same for one template with another merchant, amount, card and date', () => {
    expect(coarseShapeKey(a, 'BANK')).toBe(coarseShapeKey(b, 'BANK'))
    // The fine skeleton tells them apart, which is why it cannot count a template's evidence.
    expect(smsSkeleton(a, 'BANK')?.key).not.toBe(smsSkeleton(b, 'BANK')?.key)
  })

  it('differs by sender, by wording and by the number of numeric slots', () => {
    expect(coarseShapeKey(a, 'BANK')).not.toBe(coarseShapeKey(a, 'OTHER'))
    expect(coarseShapeKey(a, 'BANK')).not.toBe(coarseShapeKey(a.replace('Purchase of', 'Refund of'), 'BANK'))
    expect(coarseShapeKey(a, 'BANK')).not.toBe(coarseShapeKey('Purchase of EGP 75 at SOMESHOP on card ****9876', 'BANK'))
  })

  it('is null for a message too short to have a shape', () => {
    expect(coarseShapeKey('1234 5678', 'BANK')).toBeNull()
  })
})
