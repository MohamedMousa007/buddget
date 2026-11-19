import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Switch', () => {
  it('has no rtl: classes (the layout stays LTR in Arabic; a Turbopack build lowers rtl: to :lang(ar) and mirrored the thumb out of the track)', () => {
    expect(readFileSync(new URL('./switch.tsx', import.meta.url), 'utf8').match(/\brtl:/g)).toBeNull()
  })
})
