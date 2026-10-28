import { describe, expect, it, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepAbout } from './StepAbout'
import { StepGoals } from './StepGoals'
import { StepAccounts } from './StepAccounts'
import { StepIncome } from './StepIncome'
import { StepBudget } from './StepBudget'
import { FlowSetupState } from './FlowSetupState'
import { onboardingCopyAr, onboardingCopyEn } from '@/lib/i18n/onboardingCopy'
import type { StepChrome } from './chrome'

const chrome: StepChrome = { index: 0, total: 6, onSkip: vi.fn(), next: vi.fn() }
const visible = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

describe('journey screens render', () => {
  it('step 1 asks for a name, a country and a language, and promises about two minutes', () => {
    const out = visible(renderToStaticMarkup(h(StepAbout, { chrome })))
    expect(out).toContain('What should I call you?')
    expect(out).toContain('About 2 minutes')
    expect(out).toContain('Egypt')
    expect(out).toContain('English')
  })
  it('step 2 offers the five goals', () => {
    const out = visible(renderToStaticMarkup(h(StepGoals, { chrome: { ...chrome, index: 1, onBack: vi.fn() } })))
    for (const label of Object.values(onboardingCopyEn.goals.options)) expect(out).toContain(label)
  })
  it('steps 3, 4 and 6 render without a session', () => {
    expect(visible(renderToStaticMarkup(h(StepAccounts, { chrome: { ...chrome, index: 2 } })))).toContain('Where does your money live?')
    expect(visible(renderToStaticMarkup(h(StepIncome, { chrome: { ...chrome, index: 3 } })))).toContain('When does your money arrive?')
    expect(visible(renderToStaticMarkup(h(StepBudget, { chrome: { ...chrome, index: 5 } })))).toContain('Build my budget')
  })
  it('the empty Flow offers to pick up where setup stopped', () => {
    const out = visible(renderToStaticMarkup(h(FlowSetupState, {})))
    expect(out).toContain('Pick up where you left off')
    expect(out).toContain('Continue setup')
  })
})

describe('journey copy', () => {
  it('has the same shape in Arabic and English, with nothing left empty', () => {
    const walk = (a: unknown, b: unknown, path: string) => {
      expect(typeof a, path).toBe(typeof b)
      if (typeof a === 'string') expect((b as string).length, path).toBeGreaterThan(0)
      else if (typeof a === 'function') {
        expect(typeof (a as (...x: unknown[]) => unknown)(1, 2, 3, 4), path).toBe('string')
        expect(typeof (b as (...x: unknown[]) => unknown)(1, 2, 3, 4), path).toBe('string')
      } else if (a && typeof a === 'object') {
        expect(Object.keys(b as object).sort(), path).toEqual(Object.keys(a).sort())
        for (const k of Object.keys(a)) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`)
      }
    }
    walk(onboardingCopyEn, onboardingCopyAr, 'copy')
  })
})
