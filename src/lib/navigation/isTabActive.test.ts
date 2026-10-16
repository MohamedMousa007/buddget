import { describe, it, expect } from 'vitest'
import { isTabActive, activeNavHref } from './isTabActive'

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
