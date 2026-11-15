import { describe, expect, it } from 'vitest'
import { normalizeEmailKey } from './trial'

describe('normalizeEmailKey (one trial per person, S5c item 17)', () => {
  it('lower-cases and trims', () => {
    expect(normalizeEmailKey('  Test.User@Example.COM ')).toBe('test.user@example.com')
  })

  it('collapses every Gmail spelling of one mailbox to one key', () => {
    const spellings = ['first.last@gmail.com', 'firstlast@gmail.com', 'f.i.r.s.t.l.a.s.t@gmail.com', 'firstlast+shop@gmail.com', 'First.Last+a+b@GMAIL.com', 'firstlast@googlemail.com']
    expect(new Set(spellings.map(normalizeEmailKey))).toEqual(new Set(['firstlast@gmail.com']))
  })

  it('keeps dots and plus tags on other domains, where they name different mailboxes', () => {
    expect(normalizeEmailKey('a.b@example.com')).not.toBe(normalizeEmailKey('ab@example.com'))
    expect(normalizeEmailKey('a+1@example.com')).toBe('a+1@example.com')
  })

  it('refuses anything that is not an address', () => {
    for (const bad of ['', 'nobody', '@gmail.com', 'x@', '+tag@gmail.com', '...@gmail.com']) expect(normalizeEmailKey(bad), bad).toBeNull()
  })
})
