import { NextResponse } from 'next/server'

// Currencies relevant to our target markets: UAE, Egypt, GCC, global
const CURRENCIES = 'AED,EGP,EUR,GBP,SAR,KWD,QAR,BHD,OMR,MAD,TND,JOD'

interface RateSource {
  name: string
  fetch: () => Promise<Record<string, number> | null>
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
      return (data.data?.rates ?? data.rates ?? null) as Record<string, number> | null
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

export async function GET() {
  try {
    let rawRates: Record<string, number> | null = null
    let providerUsed = 'none'

    for (const source of sources) {
      try {
        rawRates = await source.fetch()
        if (rawRates && Object.keys(rawRates).length > 0) {
          providerUsed = source.name
          break
        }
      } catch {
        continue
      }
    }

    if (!rawRates) {
      return NextResponse.json(
        { error: 'All rate providers failed' },
        { status: 502 }
      )
    }

    // Build comprehensive cross-rate map
    const rates: Record<string, number> = {}
    const allCurrencies = CURRENCIES.split(',')

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

    return NextResponse.json(
      {
        rates,
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
      { status: 500 }
    )
  }
}
