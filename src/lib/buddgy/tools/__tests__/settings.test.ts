import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import type { BudgetPlan } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }
const ar: ToolContext = { ...ctx, locale: 'ar' }

const write = TOOLS.get('change_setting')!.write!
const settings = () => useFinanceStore.getState().settings
const getSettings = () => TOOLS.get('get_settings')!.read!({}, ctx) as Record<string, unknown>

const plan: BudgetPlan = {
  id: 'a1a1a1a1-0000-0000-0000-000000000001',
  name: 'Plan',
  createdAt: '2026-10-01T00:00:00.000Z',
  categories: [
    { id: 'b2b2b2b2-0000-0000-0000-000000000002', name: 'Food', icon: 'x', amount: 1000, subcategories: [] },
    { id: 'c3c3c3c3-0000-0000-0000-000000000003', name: 'Fun', icon: 'x', amount: 500, currency: 'USD', subcategories: [] },
  ],
}

beforeEach(() => {
  useFinanceStore.setState({
    settings: {
      ...DEFAULT_SETTINGS,
      baseCurrency: 'EGP',
      secondaryCurrency: 'USD',
      showSecondaryCurrency: true,
      theme: 'light',
      language: 'en',
      monthStartDay: 1,
      budgetEntryMode: 'amount',
      showCentsInDashboard: false,
      wealthGoldStrip: 'collapsed',
      subDueReminders: true,
    },
    profile: { ...DEFAULT_PROFILE, monthlyRent: 10000 },
    budgetPlans: [plan],
    exchangeRates: { EGP_USD: 0.02, USD_EGP: 50 },
  })
  useSettingsStore.setState({ buddgyNudges: true, buddgyLearning: true, voiceSpeakMuted: false })
})

const change = (setting: string, value: unknown, c: ToolContext = ctx) => write.propose({ setting, value }, c)

describe('get_settings', () => {
  it('returns compact current values', () => {
    expect(getSettings()).toMatchObject({
      theme: 'light',
      baseCurrency: 'EGP',
      secondaryCurrency: 'USD',
      showCents: false,
      monthStartDay: 1,
      goldStrip: true,
      tips: true,
      voiceReadAloud: true,
      smsTracking: false,
    })
  })
})

describe('change_setting', () => {
  it('changes the theme with undo, auto risk and an editable field', () => {
    const p = change('theme', 'dark')
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.risk).toBe('auto')
    expect(p.proposal.summary).toMatch(/^Pending approval/)
    expect(p.proposal.preview.rows).toEqual([{ label: 'Theme', before: 'Light', value: 'Dark' }])
    expect(p.proposal.preview.fields?.[0]).toMatchObject({ key: 'value', kind: 'select', value: 'dark' })
    expect(settings().theme).toBe('light')

    const applied = write.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(settings().theme).toBe('dark')
    if (applied.ok) applied.undo?.()
    expect(settings().theme).toBe('light')
  })

  it('accepts aliases and flips language', () => {
    const p = change('language', 'Arabic')
    if (!p.ok) throw new Error('expected proposal')
    const applied = write.apply(p.proposal, ctx)
    expect(settings().language).toBe('ar')
    if (applied.ok) applied.undo?.()
    expect(settings().language).toBe('en')
    expect(change('theme', 'auto').ok).toBe(true)
  })

  it('toggles store-backed switches including the device-local ones', () => {
    for (const [setting, read] of [
      ['showCents', () => settings().showCentsInDashboard],
      ['subDueReminders', () => settings().subDueReminders],
      ['onlyMyCurrencies', () => !settings().showAllCurrenciesInForms],
      ['tips', () => useSettingsStore.getState().buddgyNudges],
      ['learning', () => useSettingsStore.getState().buddgyLearning],
      ['voiceReadAloud', () => !useSettingsStore.getState().voiceSpeakMuted],
    ] as const) {
      const was = read()
      const p = change(setting, was ? 'off' : 'on')
      if (!p.ok) throw new Error(`${setting}: ${p.error}`)
      const applied = write.apply(p.proposal, ctx)
      expect(applied.ok).toBe(true)
      expect(read()).toBe(!was)
      if (applied.ok) applied.undo?.()
      expect(read()).toBe(was)
    }
  })

  it('maps the gold strip onto collapsed/hidden and keeps an expanded strip expanded', () => {
    const off = change('goldStrip', 'off')
    if (!off.ok) throw new Error('expected proposal')
    const applied = write.apply(off.proposal, ctx)
    expect(settings().wealthGoldStrip).toBe('hidden')
    if (applied.ok) applied.undo?.()
    expect(settings().wealthGoldStrip).toBe('collapsed')
    useFinanceStore.setState({ settings: { ...settings(), wealthGoldStrip: 'expanded' } })
    expect(change('goldStrip', 'on')).toMatchObject({ ok: false, error: expect.stringMatching(/already On/) })
  })

  it('treats alerts and cycle changes as normal approvals', () => {
    expect(change('subDueReminders', 'off')).toMatchObject({ ok: true, proposal: { risk: 'approve' } })
    expect(change('monthStartDay', 25)).toMatchObject({ ok: true, proposal: { risk: 'approve' } })
  })

  it('sets the pay cycle day with the new cycle range, and rejects bad days', () => {
    const p = change('monthStartDay', '25')
    if (!p.ok) throw new Error('expected proposal')
    expect(p.proposal.preview.rows[0]).toMatchObject({ before: 'Day 1', value: 'Day 25' })
    expect(p.proposal.preview.effect).toMatch(/25 Sep → 24 Oct/)
    const applied = write.apply(p.proposal, ctx)
    expect(settings().monthStartDay).toBe(25)
    if (applied.ok) applied.undo?.()
    expect(settings().monthStartDay).toBe(1)
    for (const bad of [0, 29, 12.5, 'abc', undefined]) expect(change('monthStartDay', bad).ok).toBe(false)
  })

  it('sets the entry mode', () => {
    const p = change('budgetEntryMode', 'percent')
    if (!p.ok) throw new Error('expected proposal')
    write.apply(p.proposal, ctx)
    expect(settings().budgetEntryMode).toBe('percent_of_income')
  })

  it('handles the second currency: code, off, and on with a default', () => {
    const code = change('secondaryCurrency', 'eur')
    if (!code.ok) throw new Error('expected proposal')
    const applied = write.apply(code.proposal, ctx)
    expect(settings()).toMatchObject({ secondaryCurrency: 'EUR', showSecondaryCurrency: true })
    if (applied.ok) applied.undo?.()
    expect(settings()).toMatchObject({ secondaryCurrency: 'USD', showSecondaryCurrency: true })

    const off = change('secondaryCurrency', 'off')
    if (!off.ok) throw new Error('expected proposal')
    write.apply(off.proposal, ctx)
    expect(settings().showSecondaryCurrency).toBe(false)

    useFinanceStore.setState({ settings: { ...settings(), secondaryCurrency: null, showSecondaryCurrency: false } })
    const on = change('secondaryCurrency', 'on')
    if (!on.ok) throw new Error('expected proposal')
    write.apply(on.proposal, ctx)
    expect(settings()).toMatchObject({ secondaryCurrency: 'USD', showSecondaryCurrency: true })

    expect(change('secondaryCurrency', 'EGP')).toMatchObject({ ok: false, error: expect.stringMatching(/differ/) })
  })

  it('refuses no-ops, invalid values and settings that are not changeable here', () => {
    expect(change('theme', 'light')).toMatchObject({ ok: false, error: expect.stringMatching(/already Light/) })
    expect(change('theme', 'purple').ok).toBe(false)
    expect(change('language', 'fr').ok).toBe(false)
    expect(change('showCents', 'maybe').ok).toBe(false)
    for (const blocked of ['twoFactor', 'biometric', 'password', 'sms', 'startFresh', 'deleteAccount', 'exportData', 'smsTrackingEnabled']) {
      expect(change(blocked, 'on')).toMatchObject({ ok: false, hint: expect.stringContaining('open_setting') })
    }
  })

  it('rejects an apply that no longer holds', () => {
    const p = change('theme', 'dark')
    if (!p.ok) throw new Error('expected proposal')
    useFinanceStore.setState({ settings: { ...settings(), theme: 'dark' } })
    expect(write.apply(p.proposal, ctx).ok).toBe(false)
  })

  it('localizes the preview', () => {
    const p = change('theme', 'dark', ar)
    if (!p.ok) throw new Error('expected proposal')
    expect(p.proposal.preview.title).toMatch(/تغيير الإعداد/)
    expect(p.proposal.preview.rows[0]).toMatchObject({ label: 'المظهر', before: 'فاتح', value: 'داكن' })
    const cycle = change('monthStartDay', 25, ar)
    expect(cycle.ok && cycle.proposal.preview.rows[0].value).toBe('اليوم 25')
  })
})

describe('change_setting baseCurrency', () => {
  it('is strong, previews the example and note, then switches and undoes', () => {
    const p = change('baseCurrency', 'usd')
    if (!p.ok) throw new Error('expected proposal')
    expect(p.proposal.risk).toBe('strong')
    expect(p.proposal.preview.rows[0]).toMatchObject({ before: 'EGP', value: 'USD' })
    expect(p.proposal.preview.effect).toMatch(/1,250 EGP → 25\.00 USD/)
    expect(p.proposal.preview.effect).toMatch(/older budget lines get tagged EGP/)
    expect(settings().baseCurrency).toBe('EGP')

    const applied = write.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    const s = useFinanceStore.getState()
    expect(s.settings.baseCurrency).toBe('USD')
    expect(s.settings.secondaryCurrency).toBe('EGP')
    expect(s.profile.monthlyRent).toBe(200)
    expect(s.budgetPlans[0].categories.map((c) => c.currency)).toEqual(['EGP', 'USD'])

    if (applied.ok) applied.undo?.()
    const back = useFinanceStore.getState()
    expect(back.settings).toMatchObject({ baseCurrency: 'EGP', secondaryCurrency: 'USD' })
    expect(back.profile.monthlyRent).toBe(10000)
    expect(back.budgetPlans[0]).toEqual(plan)
  })

  it('fails clearly without a rate, on the same currency and on junk', () => {
    expect(change('baseCurrency', 'KWD')).toMatchObject({ ok: false, error: 'No exchange rate from EGP to KWD yet.' })
    expect(change('baseCurrency', 'EGP')).toMatchObject({ ok: false, error: expect.stringMatching(/already EGP/) })
    expect(change('baseCurrency', 'XYZ').ok).toBe(false)
  })

  it('rejects an apply when the rate disappeared', () => {
    useFinanceStore.setState({ exchangeRates: { EGP_KWD: 0.006, KWD_EGP: 160 } })
    const p = change('baseCurrency', 'KWD')
    if (!p.ok) throw new Error('expected proposal')
    useFinanceStore.setState({ exchangeRates: {} })
    expect(write.apply(p.proposal, ctx).ok).toBe(false)
    expect(settings().baseCurrency).toBe('EGP')
  })

  it('localizes the sheet title', () => {
    const p = change('baseCurrency', 'USD', ar)
    expect(p.ok && p.proposal.preview.title).toMatch(/تغيير العملة الأساسية/)
  })
})
