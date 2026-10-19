import { describe, expect, it } from 'vitest'
import { ALL_SPECS, SPEC_BY_NAME } from '@/lib/buddgy/tools/specs'
import { toGeminiDeclaration } from '@/lib/buddgy/tools/spec'
import { SYSTEM_PROMPT } from '@/lib/server/ai/buddgy/prompt'
import { TOOLS } from '@/lib/buddgy/tools/exec'

describe('registry', () => {
  it('has unique tool names and an executor for every spec', () => {
    expect(SPEC_BY_NAME.size).toBe(ALL_SPECS.length)
    for (const s of ALL_SPECS) expect(TOOLS.has(s.name)).toBe(true)
  })

  it('keeps the cached prefix (prompt + tool declarations) lean', () => {
    const decl = JSON.stringify(ALL_SPECS.map(toGeminiDeclaration))
    const approxTokens = Math.round((decl.length + SYSTEM_PROMPT.length) / 4)
    // eslint-disable-next-line no-console
    console.log(`tools=${ALL_SPECS.length} declChars=${decl.length} promptChars=${SYSTEM_PROMPT.length} approxTokens=${approxTokens}`)
    expect(approxTokens).toBeLessThan(9000)
  })

  it('writes always declare a risk, reads never do', () => {
    for (const s of ALL_SPECS) {
      if (s.kind === 'write') expect(s.risk).toBeDefined()
      else expect(s.risk).toBeUndefined()
    }
  })

  it('deletes are strong', () => {
    for (const s of ALL_SPECS) if (/^delete_/.test(s.name)) expect(s.risk).toBe('strong')
  })
})
