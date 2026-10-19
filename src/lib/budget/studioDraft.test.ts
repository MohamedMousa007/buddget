import { describe, expect, it } from 'vitest'
import { applyAnswer, createState } from '@/lib/budget/infoGaps'
import { resumeStudioDraft, type StudioDraft } from '@/lib/budget/studioDraft'

const NOW = Date.parse('2026-10-19T12:00:00Z')
const draft = (over: Partial<StudioDraft> = {}): StudioDraft => ({
  intent: null, state: applyAnswer(createState(), 'income', 9000), savedAt: NOW - 60_000, ...over,
})

describe('resumeStudioDraft', () => {
  it('continues a recent run for the same starting point', () => {
    expect(resumeStudioDraft(draft(), null, NOW)?.answers).toEqual({ income: 9000 })
  })
  it('starts fresh without a draft, for another starting point, or when the draft is over a week old', () => {
    expect(resumeStudioDraft(null, null, NOW)).toBeNull()
    expect(resumeStudioDraft(draft({ intent: 'save' }), null, NOW)).toBeNull()
    expect(resumeStudioDraft(draft({ savedAt: NOW - 8 * 24 * 60 * 60 * 1000 }), null, NOW)).toBeNull()
  })
})
