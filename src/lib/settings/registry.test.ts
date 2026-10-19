import { describe, expect, it } from 'vitest'
import { settingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import {
  APP_SETTING_COVERAGE,
  ROOM_IDS,
  ROOM_ROUTE,
  SETTINGS_REGISTRY,
  SETTING_BY_ID,
  SETTING_IDS,
} from '@/lib/settings/registry'
import { normalizeQuery, searchSettings } from '@/lib/settings/search'
import { isShellPath } from '@/lib/navigation/shellRoutes'

describe('settings registry', () => {
  it('has exactly one entry per id', () => {
    expect(SETTINGS_REGISTRY).toHaveLength(SETTING_IDS.length)
    expect(new Set(SETTINGS_REGISTRY.map((s) => s.id)).size).toBe(SETTING_IDS.length)
  })

  it('puts every entry in a known room', () => {
    for (const s of SETTINGS_REGISTRY) expect(ROOM_IDS).toContain(s.room)
  })

  it('has English and Arabic copy for every setting and room', () => {
    for (const locale of ['en', 'ar'] as const) {
      for (const id of SETTING_IDS) {
        expect(settingsHubCopy[locale].items[id].label.length).toBeGreaterThan(1)
      }
      for (const r of ROOM_IDS) {
        expect(settingsHubCopy[locale].rooms[r].title.length).toBeGreaterThan(1)
        expect(settingsHubCopy[locale].rooms[r].remark.length).toBeGreaterThan(1)
      }
    }
  })

  it('routes only to pages the shell can render (or the legal pages)', () => {
    const pages = new Set<string>([...Object.values(ROOM_ROUTE), ...SETTINGS_REGISTRY.map((s) => s.route)])
    for (const route of pages) {
      expect(route.startsWith('/legal/') || isShellPath(route), route).toBe(true)
    }
  })

  it('accounts for every AppSettings key the default settings carry', () => {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const target = APP_SETTING_COVERAGE[key as keyof typeof APP_SETTING_COVERAGE]
      expect(target, key).toBeDefined()
      if (target !== 'internal') expect(SETTING_BY_ID[target], key).toBeDefined()
    }
  })
})

describe('searchSettings', () => {
  const top = (q: string, locale: 'en' | 'ar' = 'en') => searchSettings(q, locale)[0]

  it('finds settings by label, keyword and synonym', () => {
    expect(top('currency')).toBe('baseCurrency')
    expect(top('salary day')).toBe('payCycle')
    expect(top('dark mode')).toBe('theme')
    expect(searchSettings('cards', 'en')).toContain('paymentMethods')
  })

  it('ranks a label prefix above a keyword-only hit', () => {
    const r = searchSettings('theme', 'en')
    expect(r[0]).toBe('theme')
  })

  it('requires every word to match', () => {
    expect(searchSettings('salary banana', 'en')).toEqual([])
  })

  it('searches Arabic labels and tolerates letter variants', () => {
    expect(top('يوم الراتب', 'ar')).toBe('payCycle')
    expect(searchSettings('اشتراك', 'ar')).toContain('subDueReminders')
    expect(searchSettings('إشتراك', 'ar')).toContain('subDueReminders')
    expect(top('الوضع الداكن', 'ar')).toBeDefined()
  })

  it('matches English words while the UI is Arabic and the reverse', () => {
    expect(top('currency', 'ar')).toBe('baseCurrency')
    expect(searchSettings('جنيه', 'en')).toContain('baseCurrency')
  })

  it('hides account-only settings from signed-out users', () => {
    expect(searchSettings('password', 'en', true)).toContain('password')
    expect(searchSettings('password', 'en', false)).not.toContain('password')
  })

  it('returns nothing for an empty or whitespace query', () => {
    expect(searchSettings('', 'en')).toEqual([])
    expect(searchSettings('   ', 'en')).toEqual([])
  })

  it('normalises quotes, case and diacritics', () => {
    expect(normalizeQuery('  “Dark”  ')).toBe('dark')
    expect(normalizeQuery('إشتِراك')).toBe('اشتراك')
  })
})
