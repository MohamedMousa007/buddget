import { describe, expect, it } from 'vitest'
import { ALL_SPECS, SPEC_BY_NAME } from '@/lib/buddgy/tools/specs'
import { toGeminiDeclaration, type JsonSchema } from '@/lib/buddgy/tools/spec'
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

  it('declares schemas Gemini accepts', () => {
    const walk = (schema: JsonSchema, where: string) => {
      if (schema.type === 'object') {
        const props = Object.keys(schema.properties ?? {})
        expect(props.length, `${where}: object needs properties`).toBeGreaterThan(0)
        for (const r of schema.required ?? []) expect(props, `${where}: required ${r} missing`).toContain(r)
        for (const [k, v] of Object.entries(schema.properties ?? {})) walk(v, `${where}.${k}`)
      }
      if (schema.type === 'array') {
        expect(schema.items, `${where}: array needs items`).toBeDefined()
        walk(schema.items!, `${where}[]`)
      }
      if (schema.enum) {
        expect(schema.type, `${where}: enum on non-string`).toBe('string')
        expect(schema.enum.length, `${where}: empty enum`).toBeGreaterThan(0)
        expect(new Set(schema.enum).size, `${where}: duplicate enum values`).toBe(schema.enum.length)
      }
    }
    for (const s of ALL_SPECS) {
      expect(s.name, 'tool name').toMatch(/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/)
      expect(s.description.length, `${s.name}: description`).toBeGreaterThan(10)
      if (Object.keys(s.params.properties ?? {}).length > 0) walk(s.params, s.name)
    }
  })
})
