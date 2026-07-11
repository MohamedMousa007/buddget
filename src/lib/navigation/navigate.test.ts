import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { normalizePath, getNavPath, setNavPath } from './navStore'
import { isShellPath } from './shellRoutes'
import { navigate } from './navigate'

describe('normalizePath', () => {
  it('keeps root as /', () => {
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('')).toBe('/')
  })
  it('strips trailing slash and query/hash', () => {
    expect(normalizePath('/expenses/')).toBe('/expenses')
    expect(normalizePath('/expenses?highlight=x')).toBe('/expenses')
    expect(normalizePath('/settings/sms/#frag')).toBe('/settings/sms')
  })
})

describe('isShellPath', () => {
  it('recognizes shell routes (normalized)', () => {
    expect(isShellPath('/')).toBe(true)
    expect(isShellPath('/expenses')).toBe(true)
    expect(isShellPath('/settings/account')).toBe(true)
  })
  it('rejects non-shell / special routes', () => {
    expect(isShellPath('/admin')).toBe(false)
    expect(isShellPath('/reset-password/confirm')).toBe(false)
    expect(isShellPath('/legal/privacy')).toBe(false)
  })
})

describe('navigate', () => {
  let pushState: ReturnType<typeof vi.fn>
  let replaceState: ReturnType<typeof vi.fn>
  let assign: ReturnType<typeof vi.fn>
  let locationReplace: ReturnType<typeof vi.fn>

  beforeEach(() => {
    pushState = vi.fn()
    replaceState = vi.fn()
    assign = vi.fn()
    locationReplace = vi.fn()
    vi.stubGlobal('window', {
      history: { pushState, replaceState },
      location: { assign, replace: locationReplace },
      scrollTo: vi.fn(),
    })
    setNavPath('/')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shell route → pushState + nav store update, no full load', () => {
    navigate('/expenses?highlight=abc')
    expect(pushState).toHaveBeenCalledWith(null, '', '/expenses?highlight=abc')
    expect(getNavPath()).toBe('/expenses')
    expect(assign).not.toHaveBeenCalled()
  })

  it('shell route with replace → replaceState', () => {
    navigate('/settings', { replace: true })
    expect(replaceState).toHaveBeenCalledWith(null, '', '/settings')
    expect(getNavPath()).toBe('/settings')
  })

  it('non-shell route → hard load (assign with trailing slash), nav store unchanged', () => {
    navigate('/admin')
    expect(assign).toHaveBeenCalledWith('/admin/')
    expect(pushState).not.toHaveBeenCalled()
    expect(getNavPath()).toBe('/')
  })

  it('non-shell with query keeps the query after the slash', () => {
    navigate('/legal/privacy?ref=x')
    expect(assign).toHaveBeenCalledWith('/legal/privacy/?ref=x')
  })
})
