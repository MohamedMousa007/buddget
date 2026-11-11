import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { nextMenuIndex } from './CardActionMenu'

const SRC = join(__dirname, '../..')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

describe('A11-9 card menu keyboard model', () => {
  it('arrows wrap, Home/End jump, other keys are ignored', () => {
    expect(nextMenuIndex(3, 0, 'ArrowDown')).toBe(1)
    expect(nextMenuIndex(3, 2, 'ArrowDown')).toBe(0)
    expect(nextMenuIndex(3, 0, 'ArrowUp')).toBe(2)
    expect(nextMenuIndex(3, 1, 'Home')).toBe(0)
    expect(nextMenuIndex(3, 0, 'End')).toBe(2)
    expect(nextMenuIndex(3, 0, 'a')).toBeNull()
    expect(nextMenuIndex(0, -1, 'ArrowDown')).toBeNull()
  })
  it('focuses the first item on open and gives the opener back its focus', () => {
    const src = read('components/ui/CardActionMenu.tsx')
    expect(src).toContain("querySelector<HTMLElement>('[role=\"menuitem\"]:not([disabled])')?.focus()")
    expect(src).toContain('opener?.focus')
  })
  it.each([
    'components/features/debts/redesign/heroCardShared.tsx',
    'components/features/payments/PaymentCardCarousel.tsx',
    'components/features/goals/detail/GoalDetailSheet.tsx',
    'components/features/accounts/AccountDetailSheet.tsx',
    'components/features/budget/PlanBar.tsx',
  ])('the %s trigger announces a menu', (f) => {
    expect(read(f)).toContain('aria-haspopup="menu"')
  })
})

describe('A11-10 every aria-modal overlay manages focus', () => {
  it.each([
    'components/ui/NumberPad.tsx',
    'components/ui/UnifiedDatePicker.tsx',
    'components/expenses/ExpenseFilters.tsx',
    'components/features/settings/hub/SettingsSearch.tsx',
  ])('%s calls useDialogFocus and its panel is focusable', (f) => {
    const src = read(f)
    expect(src).toContain('useDialogFocus(')
    expect(src).toMatch(/tabIndex=\{-1\}/)
  })
})

describe('A11-11 visible labels are tied to their fields', () => {
  it.each([
    ['components/features/profile/ProfilePersonalDetailsSection.tsx', 6],
    ['components/features/settings/ProfileBody.tsx', 5],
    ['components/features/auth-modal/AuthForgotStep.tsx', 1],
    ['components/features/profile/DeleteAccountDialog.tsx', 1],
    ['components/features/income/IncomeTemplatePicker.tsx', 1],
  ])('%s', (f, count) => {
    const src = read(f)
    const labelFor = [...src.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1])
    expect(labelFor.length).toBeGreaterThanOrEqual(count)
    for (const id of labelFor) expect(src).toContain(`id="${id}"`)
  })
})

describe('A11-13 red is for destructive only; links are not colour-only', () => {
  it('SelectField open state is not red', () => {
    expect(read('components/ui/SelectField.tsx')).not.toContain('popup-open]:border-[var(--color-brand-red)]')
  })
  it.each([
    'app/(app)/legal/privacy/sections/PrivacyRightsSections.tsx',
    'app/(app)/legal/privacy/sections/PrivacyTechSections.tsx',
    'app/(app)/legal/terms/sections/TermsLegalSections.tsx',
    'app/(app)/legal/terms/sections/ar/TermsLegalSections.tsx',
  ])('%s links are underlined and not red', (f) => {
    const src = read(f)
    expect(src).not.toContain('text-[var(--color-brand-red)] hover:underline')
    expect(src).toContain('underline underline-offset-2')
  })
})

describe('A11-15 overlay layers follow the documented scale', () => {
  const ZS = (f: string) => read(f)
  it.each([
    'components/features/auth-modal/AuthModal.tsx',
    'components/features/profile/DeleteAccountDialog.tsx',
    'components/onboarding/SmsTrackingGuide.tsx',
    'components/features/goals/celebrate/GoalAchievedScreen.tsx',
    'components/features/profile/AccountDeletedScreen.tsx',
  ])('%s sits at --z-dialog, below the toast layer', (f) => {
    expect(ZS(f)).toContain('z-[var(--z-dialog)]')
    expect(ZS(f)).not.toMatch(/fixed inset-0 z-\[(100|200)\]/)
  })
  it('settings search no longer ties with confirm dialogs, and the splash stays inside the scale', () => {
    expect(ZS('components/features/settings/hub/SettingsSearch.tsx')).toContain('z-[var(--z-picker)]')
    expect(ZS('app/(app)/loading.tsx')).not.toContain('z-[9999]')
  })
})

describe('A11-16 live regions exist before their message', () => {
  it('the toast provider mounts one status region unconditionally; cards carry no role of their own', () => {
    const src = read('components/ui/ActionToast.tsx')
    expect(src).toMatch(/<div data-toast-region role="status" aria-live="polite"/)
    expect(src).not.toContain('{toasts.length ? (')
    expect(src).toContain('<span aria-hidden>✓ </span>')
  })
  it('update toast and status pill keep the region outside the conditional message', () => {
    expect(read('components/ui/UpdateToast.tsx')).toMatch(/role="status"\s+aria-live="polite"\s+>/)
    expect(read('components/ui/StatusPill.tsx')).toContain('data-inert-exempt role="status" aria-live="polite"')
  })
})

describe('A11-18 no off-palette colour utilities in the update toast', () => {
  it('uses the shadow and brand tokens, not blue-500', () => {
    expect(read('components/ui/UpdateToast.tsx')).not.toMatch(/blue-500/)
  })
})

describe('A11-19 the usage popover catcher is a real button', () => {
  it('QuotaWheel uses Scrim, not an aria-hidden div', () => {
    const src = read('components/features/ai-chat/QuotaWheel.tsx')
    expect(src).toContain('<Scrim tone="none"')
    expect(src).not.toContain('aria-hidden />')
  })
})
