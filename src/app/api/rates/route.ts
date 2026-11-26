import { NextResponse, after } from 'next/server'
import { plausibleRates } from '@/lib/utils/rateBands'
import { createServiceRoleClient, type ServiceClient } from '@/lib/supabase/service'

// Currencies relevant to our target markets: UAE, Egypt, GCC, global
const CURRENCIES = 'AED,EGP,EUR,GBP,SAR,KWD,QAR,BHD,OMR,MAD,TND,JOD,XAU'

interface RateSource {
  name: string
  fetch: () => Promise<Record<string, number> | null>
}

/** Frankfurter v2 returns `[{ quote, rate }, ...]` (or legacy `{ rates: { … } }`). */
function parseFrankfurterV2Rates(data: unknown): Record<string, number> | null {
  if (Array.isArray(data)) {
    const rates: Record<string, number> = {}
    for (const row of data) {
      if (
        row &&
        typeof row === 'object' &&
        'quote' in row &&
        'rate' in row &&
        typeof (row as { quote: unknown }).quote === 'string' &&
        typeof (row as { rate: unknown }).rate === 'number'
      ) {
        const q = (row as { quote: string; rate: number }).quote
        rates[q] = (row as { rate: number }).rate
      }
    }
    return Object.keys(rates).length ? rates : null
  }
  if (data && typeof data === 'object') {
    const o = data as { data?: { rates?: Record<string, number> }; rates?: Record<string, number> }
    const r = o.data?.rates ?? o.rates
    return r && Object.keys(r).length ? r : null
  }
  return null
}

const sources: RateSource[] = [
  {
    // Primary: ExchangeRate-API — blends ECB + commercial sources, better for emerging markets
    name: 'open.er-api.com',
    fetch: async () => {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return null
      const data = await res.json()
      if (data.result !== 'success' || !data.rates) return null
      return data.rates as Record<string, number>
    },
  },
  {
    // Fallback 1: Frankfurter v2 — 40+ central bank sources
    name: 'frankfurter.dev-v2',
    fetch: async () => {
      const res = await fetch(
        `https://api.frankfurter.dev/v2/rates?base=USD&quotes=${CURRENCIES}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return null
      const data = await res.json()
      return parseFrankfurterV2Rates(data)
    },
  },
  {
    // Fallback 2: Frankfurter v1 (original)
    name: 'frankfurter.app-v1',
    fetch: async () => {
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=USD&to=${CURRENCIES}`,
        { signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return null
      const data = await res.json()
      return (data.rates ?? null) as Record<string, number> | null
    },
  },
]

const ERROR_CACHE = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }

/** Keeps only finite, positive, plausible rates so one bad upstream value cannot poison every cross-rate. */
function validRates(rates: Record<string, number> | null): Record<string, number> | null {
  if (!rates) return null
  const clean = plausibleRates(rates)
  return Object.keys(clean).length > 0 ? clean : null
}

/** Fingerprints this instance already sent; the table dedupes too, this only spares the database repeat calls. */
const reported = new Set<string>()

/**
 * Files a missing rate in the admin Crashes queue, one row per currency per day (repeats bump its occurrences).
 * Runs after the response and never fails it. No user data: only the currency, the providers and their failures.
 */
function reportMissingRates(currencies: string[], level: 'warning' | 'error', providerUsed: string, tried: string[]) {
  const day = new Date().toISOString().slice(0, 10)
  const fresh = currencies.filter((cur) => !reported.has(`fx_rate_missing:${cur}:${day}`))
  if (fresh.length === 0) return
  for (const cur of fresh) reported.add(`fx_rate_missing:${cur}:${day}`)
  const send = async (service: ServiceClient, cur: string) => {
    const fingerprint = `fx_rate_missing:${cur}:${day}`
    try {
      const { error } = await service.rpc('record_client_crash', {
        p_fingerprint: fingerprint,
        p_release: '',
        p_title: `FX rate missing: ${cur}`,
        p_level: level,
        p_culprit: `api/rates ${providerUsed}`,
        p_stack: tried.join('\n'),
        p_platform: 'server',
        p_build: null,
        p_device_id: null,
        p_user_id: null,
        p_sentry_issue_id: null,
        p_sentry_url: null,
        p_seen: new Date().toISOString(),
      } as never)
      if (error) reported.delete(fingerprint)
    } catch {
      reported.delete(fingerprint)
    }
  }
  const forget = () => { for (const cur of fresh) reported.delete(`fx_rate_missing:${cur}:${day}`) }
  try {
    after(async () => {
      let service: ServiceClient
      try { service = createServiceRoleClient() } catch { forget(); return }
      await Promise.all(fresh.map((cur) => send(service, cur)))
    })
  } catch {
    forget()
  }
}

export async function GET() {
  try {
    let rawRates: Record<string, number> | null = null
    let providerUsed = 'none'
    const tried: string[] = []

    for (const source of sources) {
      try {
        rawRates = validRates(await source.fetch())
        if (rawRates && Object.keys(rawRates).length > 0) {
          providerUsed = source.name
          tried.push(`${source.name}: ok`)
          break
        }
        tried.push(`${source.name}: no valid rates`)
      } catch (e) {
        tried.push(`${source.name}: ${e instanceof Error ? e.name : 'error'}`)
        continue
      }
    }

    if (!rawRates) {
      reportMissingRates(['ALL'], 'error', sources[sources.length - 1].name, tried)
      return NextResponse.json(
        { error: 'All rate providers failed' },
        { status: 502, headers: ERROR_CACHE }
      )
    }

    // XAU is only on Frankfurter — merge if primary FX source omitted it
    if (!rawRates['XAU'] || rawRates['XAU'] <= 0) {
      try {
        const xauRes = await fetch(
          'https://api.frankfurter.dev/v2/rates?base=USD&quotes=XAU',
          { signal: AbortSignal.timeout(8000) }
        )
        if (xauRes.ok) {
          const xauParsed = parseFrankfurterV2Rates(await xauRes.json())
          const xau = xauParsed?.['XAU']
          if (xau && xau > 0) {
            rawRates = { ...rawRates, XAU: xau }
          }
        }
      } catch {
        /* keep rates without XAU */
      }
    }

    const merged = rawRates
    // Gold is priced by /api/gold; a missing XAU here is not an FX failure.
    const missing = CURRENCIES.split(',').filter((c) => c !== 'XAU' && !(merged[c] > 0))
    if (missing.length > 0) reportMissingRates(missing, 'warning', providerUsed, tried)

    // Build comprehensive cross-rate map
    const rates: Record<string, number> = {}
    // XAU stays out of the cross-rate table (it is per troy ounce); gold is priced via `gold` below.
    const allCurrencies = CURRENCIES.split(',').filter((c) => c !== 'XAU')

    // Store all USD-based rates
    for (const currency of allCurrencies) {
      if (rawRates[currency]) {
        rates[`USD_${currency}`] = rawRates[currency]
        rates[`${currency}_USD`] = 1 / rawRates[currency]
      }
    }

    // Compute all cross-rates between supported currencies
    // This allows direct lookup of any pair like AED_EGP, SAR_EGP, etc.
    for (const from of allCurrencies) {
      for (const to of allCurrencies) {
        if (from === to) continue
        if (!rawRates[from] || !rawRates[to]) continue
        const key = `${from}_${to}`
        if (!rates[key]) {
          rates[key] = rawRates[to] / rawRates[from]
        }
      }
    }

    let goldFromRates: { pricePerOunceUsd: number; pricePerGramUsd: number } | null = null
    if (rawRates['XAU'] && rawRates['XAU'] > 0) {
      const perOunce = 1 / rawRates['XAU']
      if (perOunce > 500 && perOunce < 50000) {
        goldFromRates = {
          pricePerOunceUsd: perOunce,
          pricePerGramUsd: perOunce / 31.1035,
        }
      }
    }

    return NextResponse.json(
      {
        rates,
        gold: goldFromRates,
        base: 'USD',
        provider: providerUsed,
        date: new Date().toISOString().split('T')[0],
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=14400',
        },
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 500, headers: ERROR_CACHE }
    )
  }
}
