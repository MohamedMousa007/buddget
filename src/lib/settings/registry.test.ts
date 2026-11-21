import { describe, expect, it } from 'vitest'
import { settingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import {
  APP_SETTING_COVERAGE,
  SETTINGS_REGISTRY,
  SETTING_BY_ID,
  SETTING_IDS,
} from '@/lib/settings/registry'
import { normalizeQuery, searchSettings } from '@/lib/settings/search'
import { isShellPath } from '@/lib/navigation/shellRoutes'
import { OPENABLE_SETTINGS } from '@/lib/buddgy/tools/specs/navigation'

describe('settings registry', () => {
  it('has exactly one entry per id', () => {
    expect(SETTINGS_REGISTRY).toHaveLength(SETTING_IDS.length)
    expect(new Set(SETTINGS_REGISTRY.map((s) => s.id)).size).toBe(SETTING_IDS.length)
  })

  it('puts every entry in a group that has a name', () => {
    for (const s of SETTINGS_REGISTRY) expect(settingsHubCopy.en.groupName[s.group].length).toBeGreaterThan(1)
  })

  it('has English and Arabic copy for every setting and group', () => {
    for (const locale of ['en', 'ar'] as const) {
      for (const id of SETTING_IDS) {
        expect(settingsHubCopy[locale].items[id].label.length).toBeGreaterThan(1)
      }
      for (const group of Object.values(settingsHubCopy[locale].groupName)) expect(group.length).toBeGreaterThan(1)
    }
  })

  it('routes only to pages the shell can render (or the legal pages)', () => {
    const pages = new Set<string>(SETTINGS_REGISTRY.map((s) => s.route))
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

describe('Privacy & lock (BDG-023)', () => {
  it('puts biometric sign-in and app lock together on the Privacy & lock screen', () => {
    for (const id of ['biometric', 'appLock'] as const) {
      expect(SETTING_BY_ID[id]).toMatchObject({ group: 'privacy', route: '/settings/privacy', kind: 'toggle' })
    }
    expect(isShellPath('/settings/privacy')).toBe(true)
    expect(settingsHubCopy.en.groupName.privacy).toBe('Privacy & lock')
    expect(settingsHubCopy.ar.groupName.privacy.length).toBeGreaterThan(1)
  })

  it('leaves the account controls on Sign-in & security', () => {
    for (const id of ['password', 'twoFactor', 'deleteAccount'] as const) expect(SETTING_BY_ID[id].route).toBe('/settings/security')
  })

  it('still resolves every setting id, and Buddgy can still open both moved switches', () => {
    for (const id of SETTING_IDS) expect(SETTING_BY_ID[id]?.id, id).toBe(id)
    expect(OPENABLE_SETTINGS).toEqual(expect.arrayContaining(['biometric', 'appLock']))
    for (const id of OPENABLE_SETTINGS) expect(SETTING_BY_ID[id], id).toBeDefined()
  })

  it('finds the moved switches from search for signed-in users', () => {
    expect(searchSettings('app lock', 'en', true)).toContain('appLock')
    expect(searchSettings('biometric', 'en', true)).toContain('biometric')
  })
})

describe('searchSettings', () => {
  const top = (q: string, locale: 'en' | 'ar' = 'en') => searchSettings(q, locale)[0]

  it('finds settings by label, keyword and synonym', () => {
    expect(top('currency')).toBe('baseCurrency')
    expect(top('dark mode')).toBe('theme')
    expect(top('delete account')).toBe('deleteAccount')
    expect(searchSettings('household', 'en')).toContain('household')
  })

  it('ranks a label prefix above a keyword-only hit', () => {
    const r = searchSettings('theme', 'en')
    expect(r[0]).toBe('theme')
  })

  it('requires every word to match', () => {
    expect(searchSettings('theme banana', 'en')).toEqual([])
  })

  it('searches Arabic labels and tolerates letter variants', () => {
    expect(top('حذف الحساب', 'ar')).toBe('deleteAccount')
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
