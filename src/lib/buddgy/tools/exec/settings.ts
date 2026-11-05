import { format } from 'date-fns'
import { arEG, enUS } from 'date-fns/locale'
import { defineTools } from '@/lib/buddgy/tools/define'
import { settingsLabels } from '@/lib/buddgy/tools/exec/settingsCopy'
import type { EditableField, Proposal, ProposeResult } from '@/lib/buddgy/tools/proposal'
import { CHANGEABLE_SETTINGS, settingsSpecs } from '@/lib/buddgy/tools/specs/settings'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, num, ok, text } from '@/lib/buddgy/tools/writeKit'
import { defaultSecondCurrency } from '@/hooks/useSettingToggle'
import { FIAT_CURRENCIES } from '@/lib/constants/finance'
import { settingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { PAY_CYCLE_MAX_DAY, PAY_CYCLE_MIN_DAY, currentCycle } from '@/lib/settings/payCycle'
import { planBaseCurrencySwitch, type BaseCurrencySwitch } from '@/lib/settings/baseCurrencySwitch'
import type { AppSettings, Currency } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyTheme } from '@/lib/theme/applyTheme'
import { convertCurrency } from '@/lib/utils/currency'

type Key = (typeof CHANGEABLE_SETTINGS)[number]
type Value = string | number | boolean

interface View {
  s: AppSettings
  tips: boolean
  learning: boolean
  muted: boolean
}

interface Patch {
  fin?: Partial<AppSettings>
  ui?: { tips?: boolean; learning?: boolean; muted?: boolean }
}

const THEMES = ['light', 'dark', 'system'] as const
const LANGUAGES = ['en', 'ar'] as const
const ENTRY_MODES = ['amount', 'percent_of_income'] as const
const SAMPLE_AMOUNT = 1250

const viewNow = (): View => ({ s: fin().settings, tips: ui().buddgyNudges, learning: ui().buddgyLearning, muted: ui().voiceSpeakMuted })

const withPatch = (v: View, p: Patch): View => ({
  s: { ...v.s, ...p.fin },
  tips: p.ui?.tips ?? v.tips,
  learning: p.ui?.learning ?? v.learning,
  muted: p.ui?.muted ?? v.muted,
})

function current(key: Key, v: View): Value {
  switch (key) {
    case 'theme': return v.s.theme
    case 'language': return v.s.language
    case 'baseCurrency': return v.s.baseCurrency
    case 'secondaryCurrency': return v.s.showSecondaryCurrency && v.s.secondaryCurrency ? v.s.secondaryCurrency : 'off'
    case 'showCents': return v.s.showCentsInDashboard
    case 'monthStartDay': return v.s.monthStartDay
    case 'budgetEntryMode': return v.s.budgetEntryMode
    case 'goldStrip': return v.s.wealthGoldStrip !== 'hidden'
    case 'onlyMyCurrencies': return !v.s.showAllCurrenciesInForms
    case 'subDueReminders': return v.s.subDueReminders ?? true
    case 'subPriceAlerts': return v.s.subPriceAlerts ?? true
    case 'goalProgressAlerts': return v.s.goalProgressAlerts ?? true
    case 'goalAlerts': return v.s.goalAlerts ?? true
    case 'tips': return v.tips
    case 'learning': return v.learning
    case 'voiceReadAloud': return !v.muted
  }
}

const toBool = (raw: unknown): boolean | undefined => {
  if (typeof raw === 'boolean') return raw
  const t = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (['on', 'true', 'yes', '1', 'enable', 'enabled', 'show'].includes(t)) return true
  if (['off', 'false', 'no', '0', 'disable', 'disabled', 'hide'].includes(t)) return false
  return undefined
}

const pick = <T extends string>(allowed: readonly T[], raw: unknown, aliases: Record<string, T> = {}): T | undefined => {
  const t = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return allowed.find((a) => a === t) ?? aliases[t]
}

const currencyOf = (raw: unknown): Currency | undefined => {
  const code = text(raw, 8)?.toUpperCase()
  return FIAT_CURRENCIES.find((c) => c === code)
}

const AUTO: readonly Key[] = ['theme', 'language', 'showCents', 'goldStrip', 'onlyMyCurrencies', 'secondaryCurrency', 'tips', 'learning', 'voiceReadAloud']

type Planned = { value: string; patch: Patch } | { error: string; hint?: string }

function plan(key: Key, raw: unknown, v: View): Planned {
  const bad = (hint: string): Planned => ({ error: `"${String(raw)}" is not a valid value for ${key}.`, hint })
  const flag = (build: (on: boolean) => Patch): Planned => {
    const on = toBool(raw)
    return on === undefined ? bad('Use on or off.') : { value: on ? 'on' : 'off', patch: build(on) }
  }
  switch (key) {
    case 'theme': {
      const theme = pick(THEMES, raw, { auto: 'system' })
      return theme ? { value: theme, patch: { fin: { theme } } } : bad('Use light, dark or system.')
    }
    case 'language': {
      const language = pick(LANGUAGES, raw, { english: 'en', arabic: 'ar' })
      return language ? { value: language, patch: { fin: { language } } } : bad('Use en or ar.')
    }
    case 'budgetEntryMode': {
      const budgetEntryMode = pick(ENTRY_MODES, raw, { percent: 'percent_of_income' })
      return budgetEntryMode ? { value: budgetEntryMode, patch: { fin: { budgetEntryMode } } } : bad('Use amount or percent_of_income.')
    }
    case 'monthStartDay': {
      const day = num(raw)
      if (day === undefined || !Number.isInteger(day) || day < PAY_CYCLE_MIN_DAY || day > PAY_CYCLE_MAX_DAY) {
        return bad(`Use a whole day from ${PAY_CYCLE_MIN_DAY} to ${PAY_CYCLE_MAX_DAY}.`)
      }
      return { value: String(day), patch: { fin: { monthStartDay: day } } }
    }
    case 'secondaryCurrency': {
      const code = currencyOf(raw)
      if (code) {
        if (code === v.s.baseCurrency) return { error: 'The second currency must differ from the main currency.' }
        return { value: code, patch: { fin: { secondaryCurrency: code, showSecondaryCurrency: true } } }
      }
      return flag((on) => ({
        fin: {
          showSecondaryCurrency: on,
          ...(on && (!v.s.secondaryCurrency || v.s.secondaryCurrency === v.s.baseCurrency)
            ? { secondaryCurrency: defaultSecondCurrency(v.s.baseCurrency) }
            : {}),
        },
      }))
    }
    case 'showCents': return flag((on) => ({ fin: { showCentsInDashboard: on } }))
    case 'goldStrip': return flag((on) => ({ fin: { wealthGoldStrip: on ? (v.s.wealthGoldStrip === 'expanded' ? 'expanded' : 'collapsed') : 'hidden' } }))
    case 'onlyMyCurrencies': return flag((on) => ({ fin: { showAllCurrenciesInForms: !on } }))
    case 'subDueReminders': return flag((on) => ({ fin: { subDueReminders: on } }))
    case 'subPriceAlerts': return flag((on) => ({ fin: { subPriceAlerts: on } }))
    case 'goalProgressAlerts': return flag((on) => ({ fin: { goalProgressAlerts: on } }))
    case 'goalAlerts': return flag((on) => ({ fin: { goalAlerts: on } }))
    case 'tips': return flag((on) => ({ ui: { tips: on } }))
    case 'learning': return flag((on) => ({ ui: { learning: on } }))
    case 'voiceReadAloud': return flag((on) => ({ ui: { muted: !on } }))
    case 'baseCurrency': throw new Error('baseCurrency has its own flow')
  }
}

function show(key: Key, v: View, ctx: ToolContext): string {
  const hub = settingsHubCopy[ctx.locale]
  const L = settingsLabels(ctx.locale)
  const value = current(key, v)
  if (typeof value === 'boolean') return value ? L.on : L.off
  switch (key) {
    case 'theme': return value === 'light' ? hub.themeLight : value === 'dark' ? hub.themeDark : L.auto
    case 'language': return value === 'ar' ? L.arabic : L.english
    case 'budgetEntryMode': return value === 'amount' ? hub.memory.entryAmount : hub.memory.entryPercent
    case 'monthStartDay': return L.day(Number(value))
    case 'secondaryCurrency': return value === 'off' ? L.off : String(value)
    default: return String(value)
  }
}

function fieldFor(key: Key, v: View, ctx: ToolContext, label: string): EditableField {
  const L = settingsLabels(ctx.locale)
  const hub = settingsHubCopy[ctx.locale]
  const options = ((): { value: string; label: string }[] => {
    switch (key) {
      case 'theme': return [{ value: 'light', label: hub.themeLight }, { value: 'dark', label: hub.themeDark }, { value: 'system', label: L.auto }]
      case 'language': return [{ value: 'en', label: L.english }, { value: 'ar', label: L.arabic }]
      case 'budgetEntryMode': return [{ value: 'amount', label: hub.memory.entryAmount }, { value: 'percent_of_income', label: hub.memory.entryPercent }]
      case 'monthStartDay': return Array.from({ length: PAY_CYCLE_MAX_DAY }, (_, i) => ({ value: String(i + 1), label: L.day(i + 1) }))
      case 'baseCurrency': return FIAT_CURRENCIES.map((c) => ({ value: c, label: c }))
      case 'secondaryCurrency': return [{ value: 'off', label: L.off }, ...FIAT_CURRENCIES.filter((c) => c !== v.s.baseCurrency).map((c) => ({ value: c, label: c }))]
      default: return [{ value: 'on', label: L.on }, { value: 'off', label: L.off }]
    }
  })()
  const now = current(key, v)
  return { key: 'value', label, kind: 'select', value: typeof now === 'boolean' ? (now ? 'on' : 'off') : String(now), options }
}

const get_settings: ReadImpl = () => {
  const v = viewNow()
  return {
    ...Object.fromEntries(CHANGEABLE_SETTINGS.map((k) => [k, current(k, v)])),
    smsTracking: v.s.smsTrackingEnabled,
  }
}

const reasonOf = (r: ProposeResult): string => (r.ok ? '' : r.error)

type BasePatch = Extract<BaseCurrencySwitch, { ok: true }>['patch']

type Built =
  | { error: ProposeResult }
  | { key: Key; patch: Patch; base?: BasePatch; message: string; proposal: Proposal }

const labelOf = (key: Key, ctx: ToolContext): string => {
  const L = settingsLabels(ctx.locale)
  if (key === 'monthStartDay') return L.monthStart
  if (key === 'onlyMyCurrencies') return L.onlyMine
  return settingsHubCopy[ctx.locale].items[key].label
}

function buildChange(args: Record<string, unknown>, ctx: ToolContext): Built {
  const key = CHANGEABLE_SETTINGS.find((k) => k === args.setting)
  if (!key) return { error: fail('That setting cannot be changed from chat.', 'Use open_setting to take the user to it.') }
  const label = labelOf(key, ctx)
  const L = settingsLabels(ctx.locale)
  const v = viewNow()
  const planned = plan(key, args.value, v)
  if ('error' in planned) return { error: fail(planned.error, planned.hint) }
  const after = withPatch(v, planned.patch)
  const before = show(key, v, ctx)
  const value = show(key, after, ctx)
  if (before === value) return { error: fail(`${label} is already ${value}.`) }

  const effect = key === 'monthStartDay' ? cycleEffect(Number(planned.value), ctx) : undefined
  return {
    key,
    patch: planned.patch,
    message: `${label}: ${value}`,
    proposal: makeProposal({
      tool: 'change_setting',
      args: { setting: key, value: planned.value },
      // Text a read tool returned (a merchant name, a note) must never change a setting without a tap.
      risk: AUTO.includes(key) && !ctx.afterRead ? 'auto' : 'approve',
      summary: `Pending approval: set ${label} to ${value}.`,
      preview: {
        domain: 'settings',
        tone: 'change',
        title: L.change(label),
        rows: [{ label, before, value }],
        fields: [fieldFor(key, after, ctx, label)],
        ...(effect ? { effect } : {}),
      },
    }),
  }
}

function cycleEffect(day: number, ctx: ToolContext): string {
  const c = settingsLabels(ctx.locale)
  const cycle = currentCycle(ctx.now, day)
  const fmt = (d: Date) => format(d, 'd MMM', { locale: ctx.locale === 'ar' ? arEG : enUS })
  return `${c.range(fmt(cycle.start), fmt(cycle.end))}. ${c.cycleNote}`
}

function baseEffect(from: Currency, to: Currency, rates: Record<string, number>, ctx: ToolContext): string {
  const c = settingsHubCopy[ctx.locale].currency
  const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2))
  const sample = `${fmt(SAMPLE_AMOUNT)} ${from} → ${fmt(convertCurrency(SAMPLE_AMOUNT, from, to, rates))} ${to}`
  return `${c.sample(sample)}. ${c.note(from)}`
}

function buildBase(args: Record<string, unknown>, ctx: ToolContext): Built {
  const s = fin()
  const next = currencyOf(args.value)
  if (!next) return { error: fail(`"${String(args.value)}" is not a supported currency.`, 'Use an ISO code such as USD.') }
  const result = planBaseCurrencySwitch(
    { settings: s.settings, profile: s.profile, budgetPlans: s.budgetPlans, exchangeRates: s.exchangeRates, goldPricePerGram: s.goldPricePerGram },
    next,
  )
  const old = s.settings.baseCurrency
  if (!result.ok) {
    return {
      error: result.reason === 'same'
        ? fail(`The main currency is already ${old}.`)
        : fail(`No exchange rate from ${old} to ${next} yet.`, 'Rates may still be loading. Try again later.'),
    }
  }
  const hub = settingsHubCopy[ctx.locale]
  const label = labelOf('baseCurrency', ctx)
  return {
    key: 'baseCurrency',
    patch: {},
    base: result.patch,
    message: hub.currency.toast(next),
    proposal: makeProposal({
      tool: 'change_setting',
      args: { setting: 'baseCurrency', value: next },
      risk: 'strong',
      summary: `Pending approval: switch the main currency from ${old} to ${next}.`,
      preview: {
        domain: 'settings',
        tone: 'change',
        title: hub.currency.sheetTitle(next),
        rows: [{ label, before: old, value: next }],
        fields: [fieldFor('baseCurrency', viewNow(), ctx, label)],
        effect: baseEffect(old, next, s.exchangeRates, ctx),
      },
    }),
  }
}

const build = (args: Record<string, unknown>, ctx: ToolContext): Built =>
  args.setting === 'baseCurrency' ? buildBase(args, ctx) : buildChange(args, ctx)

function applyBase(patch: BasePatch): () => void {
  const before = fin()
  const previous = { baseCurrency: before.settings.baseCurrency, secondaryCurrency: before.settings.secondaryCurrency }
  const { profile, budgetPlans, goldPricePerGram } = before
  useFinanceStore.setState(patch)
  return () => {
    fin().updateSettings(previous)
    useFinanceStore.setState({ profile, budgetPlans, goldPricePerGram })
  }
}

type UiKey = keyof NonNullable<Patch['ui']>

function writePatch(fp: Partial<AppSettings>, up: NonNullable<Patch['ui']>) {
  if (Object.keys(fp).length > 0) {
    fin().updateSettings(fp)
    if (fp.theme) applyTheme(fp.theme)
  }
  if (up.tips !== undefined) ui().setBuddgyNudges(up.tips)
  if (up.learning !== undefined) ui().setBuddgyLearning(up.learning)
  if (up.muted !== undefined) ui().setVoiceSpeakMuted(up.muted)
}

const change_setting: WriteImpl = {
  propose(args, ctx) {
    const built = build(args, ctx)
    return 'error' in built ? built.error : ok(built.proposal)
  },
  apply(proposal, ctx) {
    const built = build(proposal.args, ctx)
    if ('error' in built) return { ok: false, error: reasonOf(built.error) }
    if (built.base) return { ok: true, message: built.message, undo: applyBase(built.base) }

    const v = viewNow()
    const nextFin = built.patch.fin ?? {}
    const nextUi = built.patch.ui ?? {}
    const prevFin = Object.fromEntries(Object.keys(nextFin).map((k) => [k, v.s[k as keyof AppSettings]])) as Partial<AppSettings>
    const prevUi = Object.fromEntries(Object.keys(nextUi).map((k) => [k, v[k as UiKey]])) as NonNullable<Patch['ui']>
    writePatch(nextFin, nextUi)
    return { ok: true, message: built.message, undo: () => writePatch(prevFin, prevUi) }
  },
}

export const settingsTools = defineTools(settingsSpecs, { get_settings, change_setting })
