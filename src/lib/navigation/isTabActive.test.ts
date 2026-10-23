import { describe, it, expect } from 'vitest'
import { isTabActive, activeNavHref } from './isTabActive'
import { BOTTOM_NAV_ITEMS, BUDGET_PATHS } from './bottomNavConfig'

const HREFS = ['/flow', '/budget-setup', '/wealth', '/debts', '/reports', '/paydays', '/goals', '/subscriptions', '/settings']

describe('isTabActive', () => {
  it('lights Flow for root and its aliases', () => {
    for (const p of ['/', '/flow', '/expenses', '/income', '/paydays']) expect(isTabActive(p, '/flow')).toBe(true)
  })
  it('lights Wealth for savings/investment and sub-routes', () => {
    expect(isTabActive('/savings', '/wealth')).toBe(true)
    expect(isTabActive('/wealth/gold', '/wealth')).toBe(true)
    expect(isTabActive('/debts', '/wealth')).toBe(false)
  })
  it('matches non-tab destinations by path prefix', () => {
    expect(isTabActive('/settings/ai', '/settings')).toBe(true)
    expect(isTabActive('/settingsx', '/settings')).toBe(false)
  })
})

describe('bottom bar', () => {
  it('runs Flow, Accounts, the add button, Wealth, then Debts', () => {
    expect(BOTTOM_NAV_ITEMS.map((i) => (i.kind === 'fab' ? 'fab' : i.href))).toEqual(['/flow', '/accounts', 'fab', '/wealth', '/debts'])
  })
  it('Debts is its own tab and no longer lights Accounts', () => {
    expect(isTabActive('/debts', '/debts')).toBe(true)
    expect(isTabActive('/debts', '/accounts')).toBe(false)
    expect(isTabActive('/accounts', '/accounts')).toBe(true)
  })
  it('Budget is in the header: its screens are not a tab, but the sidebar still lights it', () => {
    expect(BOTTOM_NAV_ITEMS.some((i) => i.kind === 'link' && i.href === '/budget-setup')).toBe(false)
    for (const p of BUDGET_PATHS) expect(isTabActive(p, '/budget-setup')).toBe(true)
  })
})

describe('activeNavHref', () => {
  it('prefers a destination own row over another tab alias', () => {
    expect(activeNavHref('/paydays', HREFS)).toBe('/paydays')
    expect(activeNavHref('/subscriptions', HREFS)).toBe('/subscriptions')
  })
  it('falls back to the alias tab', () => {
    expect(activeNavHref('/', HREFS)).toBe('/flow')
    expect(activeNavHref('/savings', HREFS)).toBe('/wealth')
  })
  it('returns null when nothing matches', () => {
    expect(activeNavHref('/nope', HREFS)).toBeNull()
  })
})
