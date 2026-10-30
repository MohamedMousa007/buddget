import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** A stored expense category (Food, Rent...) must reach the screen through categoryLabel / useCategoryLabel. */
const RAW = />\s*\{\s*(?!(?:t|c|r|f|ui|rc|tt|copy|text)\.)(?:[A-Za-z_]\w*\??\.)*(?:category|cat|categoryName)\s*\}/

/** Files whose `.category` is not an expense category (dictionary labels, brand/goal/product/site/admin categories). */
const ALLOWED = [
  'src/components/voice/VoiceRecapEditor.tsx',
  'src/components/features/debts/redesign/InstallmentProviderPickerSheet.tsx',
  'src/components/site/',
  'src/components/features/admin/',
  'src/components/features/onboarding/StepAutomate.tsx',
  'src/components/onboarding/SmsTrackingGuide.tsx',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx') && !p.endsWith('.test.tsx')) out.push(p)
  }
  return out
}

describe('raw category rendering', () => {
  it('no component prints a stored category without categoryLabel', () => {
    const offenders: string[] = []
    for (const file of [...walk('src/components'), ...walk('src/app')]) {
      if (ALLOWED.some((a) => file.startsWith(a))) continue
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (RAW.test(line) && !/categoryLabel|catLabel/.test(line)) offenders.push(`${file}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
