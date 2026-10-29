import { describe, expect, it } from 'vitest'
import { isPhantomTranscript } from './whisperEcho'

const PROMPT = 'Common merchants: Talabat, Otlob, Carrefour Egypt, Spinneys Egypt, Gourmet, Seoudi. Egyptian Arabic phrases: متشكر, دفعت, اشتريت, جنيه.'

describe('isPhantomTranscript', () => {
  it('rejects an echo of the prompt', () => {
    expect(isPhantomTranscript('Carrefour Egypt, Spinneys Egypt, Gourmet', PROMPT)).toBe(true)
    expect(isPhantomTranscript('Egyptian Arabic phrases: متشكر, دفعت', PROMPT)).toBe(true)
  })

  it('rejects empty and very short hallucinations', () => {
    expect(isPhantomTranscript('', PROMPT)).toBe(true)
    expect(isPhantomTranscript(' . ', PROMPT)).toBe(true)
    expect(isPhantomTranscript('uh', PROMPT)).toBe(true)
  })

  it('rejects the stock silence hallucinations', () => {
    expect(isPhantomTranscript('Thanks for watching!', PROMPT)).toBe(true)
    expect(isPhantomTranscript('شكرا على المشاهدة', PROMPT)).toBe(true)
  })

  it('keeps a real expense', () => {
    expect(isPhantomTranscript('spent 250 pounds at Talabat', PROMPT)).toBe(false)
    expect(isPhantomTranscript('دفعت ٥٠ جنيه في كافيه', PROMPT)).toBe(false)
  })
})
