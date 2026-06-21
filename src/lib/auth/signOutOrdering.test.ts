import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const src = (rel: string) => readFileSync(join(process.cwd(), 'src', rel), 'utf-8')

/** Strip single-line comments so assertions don't match explanatory prose. */
function stripLineComments(code: string): string {
  return code
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//'))
    .join('\n')
}

describe('AuthProvider.signOut — source invariants', () => {
  const code = src('components/auth/AuthProvider.tsx')
  const signOutStart = code.indexOf('const signOut = useCallback')
  // The signOut deps array closes the function — use it as the end boundary.
  const signOutEnd = code.indexOf('}, [configured, session])', signOutStart) + 25
  const signOutBody = stripLineComments(code.slice(signOutStart, signOutEnd))

  it('router.refresh() is absent from the signOut function (was the session-restore race condition)', () => {
    expect(signOutBody).not.toMatch(/router\.refresh\s*\(\s*\)/)
  })

  it('signOut deps array contains [configured, session] — no router', () => {
    // router was removed from deps when router.refresh() was removed
    expect(code).toMatch(/\}, \[configured, session\]\)/)
  })

  it('suspendFinanceSync is called before setUser(null)', () => {
    const suspendPos = signOutBody.indexOf('suspendFinanceSync()')
    const setUserPos = signOutBody.indexOf('setUser(null)')
    expect(suspendPos).toBeGreaterThan(-1)
    expect(suspendPos).toBeLessThan(setUserPos)
  })

  it('setUser(null) and setSession(null) are called synchronously before the background IIFE', () => {
    const setUserPos = signOutBody.indexOf('setUser(null)')
    const setSessionPos = signOutBody.indexOf('setSession(null)')
    const iifePos = signOutBody.indexOf('void (async () => {')
    expect(setUserPos).toBeGreaterThan(-1)
    expect(setSessionPos).toBeGreaterThan(-1)
    expect(setUserPos).toBeLessThan(iifePos)
    expect(setSessionPos).toBeLessThan(iifePos)
  })

  it('flushFinanceNow is called before clearBudgetData in the background IIFE', () => {
    const flushPos = signOutBody.indexOf('flushFinanceNow()')
    const clearPos = signOutBody.indexOf('clearBudgetData()')
    expect(flushPos).toBeGreaterThan(-1)
    expect(clearPos).toBeGreaterThan(flushPos)
  })

  it("supabase.auth.signOut({scope:'local'}) is the last step in the background IIFE", () => {
    const supabasePos = signOutBody.indexOf("supabase.auth.signOut({ scope: 'local' })")
    const clearPos = signOutBody.indexOf('clearBudgetData()')
    const flushPos = signOutBody.indexOf('flushFinanceNow()')
    expect(supabasePos).toBeGreaterThan(clearPos)
    expect(supabasePos).toBeGreaterThan(flushPos)
  })
})

describe('useSettingsPage.signOutAndHome — caller invariants', () => {
  const code = src('hooks/useSettingsPage.ts')

  it('signOutAndHome does not call clearBudgetData (would trigger 2.5s splash before signOut completes)', () => {
    const fnStart = code.indexOf('const signOutAndHome = async')
    const fnEnd = code.indexOf('\n  }', fnStart)
    const body = stripLineComments(code.slice(fnStart, fnEnd))
    expect(body).not.toContain('clearBudgetData')
  })

  it('router.replace is not called (route teardown belongs to signOut)', () => {
    const nonComments = stripLineComments(code)
    expect(nonComments).not.toMatch(/router\.replace\s*\(/)
  })

  it('signOutAndHome delegates to signOut() — nothing else', () => {
    const fnStart = code.indexOf('const signOutAndHome = async')
    const fnEnd = code.indexOf('\n  }', fnStart)
    const body = stripLineComments(code.slice(fnStart, fnEnd))
    expect(body).toMatch(/await signOut\s*\(\s*\)/)
  })
})

describe('useProfilePage.confirmDelete — caller invariants', () => {
  const code = src('hooks/useProfilePage.ts')
  const confirmStart = code.indexOf('const confirmDelete = useCallback')
  const confirmEnd = code.indexOf('}, [t.profile.deleteAccountError])', confirmStart)

  it('confirmDelete callback is present with correct deps', () => {
    expect(confirmStart).toBeGreaterThan(-1)
    expect(confirmEnd).toBeGreaterThan(confirmStart)
  })

  it('signOut() is not called inside confirmDelete (was preventing AccountDeletedScreen from rendering)', () => {
    const body = stripLineComments(code.slice(confirmStart, confirmEnd))
    expect(body).not.toMatch(/\bsignOut\s*\(/)
  })

  it('setDeleteSuccess(true) is called on API success', () => {
    const body = code.slice(confirmStart, confirmEnd)
    expect(body).toMatch(/setDeleteSuccess\s*\(\s*true\s*\)/)
  })

  it('setDeleteSuccess(true) comes before any signOut call in the non-comment code', () => {
    const body = stripLineComments(code.slice(confirmStart, confirmEnd))
    const setSuccessPos = body.indexOf('setDeleteSuccess(true)')
    const signOutPos = body.indexOf('signOut(')
    expect(setSuccessPos).toBeGreaterThan(-1)
    // signOut must be absent OR appear after setDeleteSuccess
    if (signOutPos !== -1) {
      expect(setSuccessPos).toBeLessThan(signOutPos)
    }
  })
})

describe('AccountDeletedScreen — cleanup ordering', () => {
  const code = src('components/features/profile/AccountDeletedScreen.tsx')

  it("calls supabase signOut({scope:'local'}) before window.location.assign", () => {
    const signOutPos = code.indexOf("signOut({ scope: 'local' })")
    const assignPos = code.indexOf("window.location.assign('/')")
    expect(signOutPos).toBeGreaterThan(-1)
    expect(assignPos).toBeGreaterThan(-1)
    expect(signOutPos).toBeLessThan(assignPos)
  })

  it('supabase signOut is wrapped in try/catch (user already deleted — safe to ignore)', () => {
    const tryPos = code.indexOf('try {')
    const signOutPos = code.indexOf("signOut({ scope: 'local' })")
    expect(tryPos).toBeGreaterThan(-1)
    expect(signOutPos).toBeGreaterThan(tryPos)
  })
})
