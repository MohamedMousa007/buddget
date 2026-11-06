import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (name === '__qa6__' || name === 'node_modules') continue
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** Every `<AmountField ...>` opening tag in the app, with its source file. */
function amountFieldTags(): { file: string; tag: string }[] {
  const tags: { file: string; tag: string }[] = []
  for (const file of walk('src')) {
    if (file.endsWith('AmountField.tsx')) continue
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/<AmountField\b/g)) {
      let i = m.index! + m[0].length
      let depth = 0
      for (; i < src.length; i++) {
        const c = src[i]
        if (c === '{') depth++
        else if (c === '}') depth--
        else if (c === '>' && depth === 0 && src[i - 1] !== '=') break
      }
      tags.push({ file, tag: src.slice(m.index!, i + 1) })
    }
  }
  return tags
}

const mode = (tag: string) => /mode=\{?['"](\w+)/.exec(tag)?.[1] ?? 'decimal'

describe('AmountField call sites (FRM-6)', () => {
  const tags = amountFieldTags()
  it('finds the app\'s amount boxes', () => {
    expect(tags.length).toBeGreaterThan(30)
  })
  it('every money box is told its currency, so KWD / BHD / OMR / JOD / TND accept the third decimal', () => {
    // A plan length in months is a decimal-mode number but not money.
    const notMoney = (t: string) => t.includes('fPlanLength')
    const missing = tags
      .filter(({ tag }) => mode(tag) === 'decimal' && !notMoney(tag) && !/\b(currency|decimalsFor)=/.test(tag))
      .map(({ file }) => file)
    expect(missing).toEqual([])
  })
  it('every integer / pin box has an explicit accessible name (the generic "Amount" would be wrong)', () => {
    const unnamed = tags
      .filter(({ tag }) => mode(tag) !== 'decimal' && !/\b(label|aria-label|id)=/.test(tag))
      .map(({ file }) => file)
    expect(unnamed).toEqual([])
  })
})
