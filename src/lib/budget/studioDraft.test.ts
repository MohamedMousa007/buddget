import { describe, expect, it } from 'vitest'
import { answer, createFlow } from '@/lib/budget/flow/flow'
import { resumeStudioDraft, type StudioDraft } from '@/lib/budget/studioDraft'

const NOW = Date.parse('2026-10-19T12:00:00Z')
const draft = (over: Partial<StudioDraft> = {}): StudioDraft => ({
  v: 3, intent: null, state: answer(createFlow('mixed'), 'income', 9000), savedAt: NOW - 60_000, ...over,
})

describe('resumeStudioDraft', () => {
  it('continues a recent run for the same starting point', () => {
    expect(resumeStudioDraft(draft(), null, NOW)?.a).toEqual({ income: 9000 })
  })
  it('starts fresh without a draft, for another starting point, or when the draft is over a week old', () => {
    expect(resumeStudioDraft(null, null, NOW)).toBeNull()
    expect(resumeStudioDraft(draft({ intent: 'save' }), null, NOW)).toBeNull()
    expect(resumeStudioDraft(draft({ savedAt: NOW - 8 * 24 * 60 * 60 * 1000 }), null, NOW)).toBeNull()
  })
  it('drops a draft written for an older set of questions', () => {
    expect(resumeStudioDraft({ ...draft(), v: 2 } as unknown as StudioDraft, null, NOW)).toBeNull()
  })
})
