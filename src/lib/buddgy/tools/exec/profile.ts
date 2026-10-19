import { defineTools } from '@/lib/buddgy/tools/define'
import { profileLabels } from '@/lib/buddgy/tools/exec/profileCopy'
import type { EditableField, PreviewRow } from '@/lib/buddgy/tools/proposal'
import { profileSpecs } from '@/lib/buddgy/tools/specs/profile'
import { fin } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, WriteImpl } from '@/lib/buddgy/tools/types'
import { fail, makeProposal, money, num, ok, text } from '@/lib/buddgy/tools/writeKit'
import { countryNameEnFromCode, PROFILE_COUNTRY_OPTIONS, resolveProfileCountryToCode } from '@/lib/profile/countryOptions'
import type { UserProfile } from '@/lib/store/types'

const ENUMS = {
  household: ['solo', 'couple', 'family'],
  lifestyleTier: ['minimal', 'balanced', 'comfortable'],
  foodFrequency: ['everyday', 'mostdays', 'sometimes', 'rarely'],
  transportMode: ['public', 'car', 'taxi', 'walk'],
} as const

type EnumKey = keyof typeof ENUMS
const ENUM_KEYS = Object.keys(ENUMS) as EnumKey[]

const arabicNames = new Intl.DisplayNames(['ar'], { type: 'region' })

function resolveCountry(input: string): string | null {
  const code = resolveProfileCountryToCode(input)
  if (code) return countryNameEnFromCode(code) ?? null
  const wanted = input.trim()
  const hit = PROFILE_COUNTRY_OPTIONS.find((o) => arabicNames.of(o.code) === wanted)
  return hit?.nameEn ?? null
}

const get_profile: ReadImpl = () => {
  const s = fin()
  const p = s.profile
  const definedOnly = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''))
  return definedOnly({
    name: p.name,
    country: p.country,
    city: p.city,
    household: p.household,
    lifestyle: p.lifestyleTier,
    eatingOut: p.foodFrequency,
    transport: p.transportMode,
    rent: p.monthlyRent,
    rentCur: p.monthlyRent != null ? s.settings.baseCurrency : undefined,
    rentIncludesUtilities: p.monthlyRent != null ? (p.rentIncludesUtilities ?? false) : undefined,
  })
}

type Patch = Partial<Pick<UserProfile, 'name' | 'country' | 'city' | 'household' | 'lifestyleTier' | 'foodFrequency' | 'transportMode' | 'monthlyRent' | 'rentIncludesUtilities'>>

const update_profile: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const p = s.profile
    const L = profileLabels(ctx.locale)
    const patch: Patch = {}
    const rows: PreviewRow[] = []
    const fields: EditableField[] = []
    const enumLabel = (key: EnumKey, v: string | null | undefined) => (v ? (L[`${key}_`] as Record<string, string>)[v] : L.none)

    if (args.name !== undefined) {
      const name = text(args.name, 60)
      if (!name) return fail('The name cannot be empty.')
      if (name !== p.name) {
        patch.name = name
        rows.push({ label: L.name, before: p.name || L.none, value: name })
        fields.push({ key: 'name', label: L.name, kind: 'text', value: name })
      }
    }
    if (args.country !== undefined) {
      const input = text(args.country, 60)
      const country = input ? resolveCountry(input) : null
      if (!country) return fail('Unknown country.', 'Use the country name or its 2-letter ISO code.')
      if (country !== p.country) {
        patch.country = country
        rows.push({ label: L.country, before: p.country || L.none, value: country })
      }
    }
    if (args.city !== undefined) {
      const city = typeof args.city === 'string' ? args.city.trim().replace(/\s+/g, ' ').slice(0, 60) : undefined
      if (city === undefined) return fail('The city must be text.')
      if (city !== (p.city ?? '')) {
        patch.city = city
        rows.push({ label: L.city, before: p.city || L.none, value: city || L.none })
        fields.push({ key: 'city', label: L.city, kind: 'text', value: city })
      }
    }
    for (const key of ENUM_KEYS) {
      if (args[key] === undefined) continue
      const v = args[key]
      if (typeof v !== 'string' || !(ENUMS[key] as readonly string[]).includes(v)) return fail(`${key} must be one of: ${ENUMS[key].join(', ')}.`)
      if (v !== p[key]) {
        ;(patch as Record<string, unknown>)[key] = v
        rows.push({ label: L[key], before: enumLabel(key, p[key]), value: enumLabel(key, v) })
        fields.push({ key, label: L[key], kind: 'select', value: v, options: ENUMS[key].map((o) => ({ value: o, label: enumLabel(key, o) })) })
      }
    }
    if (args.monthlyRent !== undefined) {
      const rent = num(args.monthlyRent)
      if (rent === undefined || rent < 0) return fail('Rent must be zero or more, in the base currency.')
      if (rent !== p.monthlyRent) {
        const base = s.settings.baseCurrency
        patch.monthlyRent = rent
        rows.push({ label: L.monthlyRent, before: p.monthlyRent != null ? money(p.monthlyRent, base) : L.none, value: money(rent, base) })
        fields.push({ key: 'monthlyRent', label: L.monthlyRent, kind: 'amount', value: String(rent), currency: base })
      }
    }
    if (args.rentIncludesUtilities !== undefined) {
      if (typeof args.rentIncludesUtilities !== 'boolean') return fail('rentIncludesUtilities must be true or false.')
      if (args.rentIncludesUtilities !== (p.rentIncludesUtilities ?? false)) {
        patch.rentIncludesUtilities = args.rentIncludesUtilities
        const yn = (b: boolean) => (b ? L.yes : L.no)
        rows.push({ label: L.rentIncludesUtilities, before: yn(p.rentIncludesUtilities ?? false), value: yn(args.rentIncludesUtilities) })
      }
    }
    if (rows.length === 0) return fail('Nothing would change.')

    return ok(
      makeProposal({
        tool: 'update_profile',
        args: patch as Record<string, unknown>,
        risk: 'approve',
        summary: `Pending approval: update profile (${Object.keys(patch).join(', ')}).`,
        preview: { domain: 'profile', tone: 'change', title: L.title, rows, fields },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = update_profile.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const patch = again.proposal.args as Patch
    const profile = fin().profile
    const previous: Record<string, unknown> = {}
    for (const key of Object.keys(patch) as (keyof Patch)[]) previous[key] = profile[key]
    fin().updateProfile(patch)
    return { ok: true, message: profile.name, undo: () => fin().updateProfile(previous as Partial<UserProfile>) }
  },
}

export const profileTools = defineTools(profileSpecs, { get_profile, update_profile })
