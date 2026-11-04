import { describe, expect, it } from 'vitest'
import { NODES } from '@/lib/budget/flow/nodes'
import { flowCopyAr, flowCopyEn } from './flowCopy'

describe('flow copy', () => {
  for (const [lang, copy] of [['en', flowCopyEn], ['ar', flowCopyAr]] as const) {
    it(`${lang}: every question has a label, a reason and a label for every option`, () => {
      for (const n of NODES) {
        const c = copy[n.id]
        expect(c.label.length, `${n.id} label`).toBeGreaterThan(1)
        expect(c.why.length, `${n.id} why`).toBeGreaterThan(1)
        for (const o of n.opts ?? []) expect(c.opts?.[o], `${n.id}.${o}`).toBeTruthy()
      }
    })
  }
  it('ar: nothing is left in English', () => {
    const latin = /[A-Za-z]{3,}/
    const bare = (s: string) => s.replace(/\{[a-z]+\}/g, '')
    for (const n of NODES) {
      expect(bare(flowCopyAr[n.id].label), n.id).not.toMatch(latin)
      expect(flowCopyAr[n.id].why, n.id).not.toMatch(latin)
      for (const [o, v] of Object.entries(flowCopyAr[n.id].opts ?? {})) expect(v, `${n.id}.${o}`).not.toMatch(latin)
    }
  })
  it('every wording variant a question can pick has copy in both languages', () => {
    const keys: Record<string, string[]> = { hasDebts: ['mortgage', 'car'], debtKinds: ['known'], rentIncludesUtilities: ['company'], goalTarget: ['down'] }
    for (const [id, vs] of Object.entries(keys)) for (const v of vs) { expect(flowCopyEn[id].variants?.[v]).toBeTruthy(); expect(flowCopyAr[id].variants?.[v]).toBeTruthy() }
  })
})
