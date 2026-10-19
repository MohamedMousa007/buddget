import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const write = () => {
  const w = TOOLS.get('update_profile')?.write
  if (!w) throw new Error('no update_profile')
  return w
}
const state = () => useFinanceStore.getState()

beforeEach(() => {
  useFinanceStore.setState({
    profile: {
      ...state().profile,
      id: 'u1',
      name: 'Mona',
      email: 'mona@example.com',
      phone: '+20100000000',
      country: 'Egypt',
      city: 'Cairo',
      household: 'solo',
      lifestyleTier: 'balanced',
      foodFrequency: 'sometimes',
      transportMode: 'public',
      monthlyRent: 8000,
      rentIncludesUtilities: false,
    },
    settings: { ...state().settings, baseCurrency: 'EGP' },
  })
})

describe('get_profile', () => {
  it('returns the safe fields and never contact details', () => {
    const res = TOOLS.get('get_profile')?.read?.({}, ctx) as Record<string, unknown>
    expect(res).toMatchObject({ name: 'Mona', country: 'Egypt', city: 'Cairo', household: 'solo', lifestyle: 'balanced', rent: 8000, rentCur: 'EGP', rentIncludesUtilities: false })
    expect(JSON.stringify(res)).not.toMatch(/mona@example|\+2010/)
  })

  it('omits unset fields', () => {
    useFinanceStore.setState({ profile: { ...state().profile, city: undefined, monthlyRent: null, household: null } })
    const res = TOOLS.get('get_profile')?.read?.({}, ctx) as Record<string, unknown>
    expect(res).not.toHaveProperty('city')
    expect(res).not.toHaveProperty('rent')
    expect(res).not.toHaveProperty('household')
  })
})

describe('update_profile', () => {
  it('changes household, rent and utilities in one proposal, then undoes', () => {
    const p = write().propose({ household: 'family', monthlyRent: 12000, rentIncludesUtilities: true }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.preview.rows.map((r) => r.label)).toEqual(['Household', 'Monthly rent', 'Rent includes utilities'])
    expect(state().profile.household).toBe('solo')
    const applied = write().apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().profile).toMatchObject({ household: 'family', monthlyRent: 12000, rentIncludesUtilities: true })
    if (applied.ok) applied.undo?.()
    expect(state().profile).toMatchObject({ household: 'solo', monthlyRent: 8000, rentIncludesUtilities: false })
  })

  it('normalizes a country code or Arabic name to the stored English name', () => {
    const byCode = write().propose({ country: 'sa' }, ctx)
    expect(byCode.ok && byCode.proposal.args.country).toBe('Saudi Arabia')
    const byArabic = write().propose({ country: 'الإمارات العربية المتحدة' }, ctx)
    expect(byArabic.ok && byArabic.proposal.args.country).toBe('United Arab Emirates')
    expect(write().propose({ country: 'Atlantis' }, ctx).ok).toBe(false)
    expect(write().propose({ country: 'IL' }, ctx).ok).toBe(false)
  })

  it('can clear the city and undo restores it', () => {
    const p = write().propose({ city: '' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = write().apply(p.proposal, ctx)
    expect(state().profile.city).toBe('')
    if (applied.ok) applied.undo?.()
    expect(state().profile.city).toBe('Cairo')
  })

  it('updates lifestyle fields and name', () => {
    const p = write().propose({ name: '  Mona M ', lifestyleTier: 'minimal', foodFrequency: 'rarely', transportMode: 'car' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    write().apply(p.proposal, ctx)
    expect(state().profile).toMatchObject({ name: 'Mona M', lifestyleTier: 'minimal', foodFrequency: 'rarely', transportMode: 'car' })
  })

  it('rejects invalid values and no-ops', () => {
    expect(write().propose({ household: 'tribe' }, ctx).ok).toBe(false)
    expect(write().propose({ monthlyRent: -5 }, ctx).ok).toBe(false)
    expect(write().propose({ name: ' ' }, ctx).ok).toBe(false)
    expect(write().propose({ rentIncludesUtilities: 'yes' }, ctx).ok).toBe(false)
    expect(write().propose({ household: 'solo' }, ctx).ok).toBe(false)
    expect(write().propose({}, ctx).ok).toBe(false)
  })

  it('ignores fields it does not own', () => {
    const p = write().propose({ email: 'x@y.z', phone: '1', household: 'couple' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    expect(Object.keys(p.proposal.args)).toEqual(['household'])
    write().apply(p.proposal, ctx)
    expect(state().profile).toMatchObject({ email: 'mona@example.com', phone: '+20100000000' })
  })

  it('shows the before value and localizes to Arabic', () => {
    const p = write().propose({ household: 'family' }, { ...ctx, locale: 'ar' })
    expect(p.ok && p.proposal.preview.rows[0]).toMatchObject({ label: 'الأسرة', before: 'أنا فقط', value: 'عائلة' })
  })
})
