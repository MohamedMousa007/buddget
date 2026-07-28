import { priceConsensus } from '@/lib/prices/consensus'
import { EGYPT_SAGHA_SOURCES } from '@/lib/prices/egyptSaghaSources'

const TROY_OUNCE_GRAMS = 31.1035
const UA = 'Mozilla/5.0 (compatible; BuddgetBot/1.0; +https://buddget.app)'

async function getJson(url: string, ms = 6000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return res.json()
}

/** Global spot gold, USD per troy ounce — keyless providers, clustered. Null if all fail. */
export async function fetchSpotOunceUsd(): Promise<number | null> {
  const providers: Array<{ source: string; upstream: string; fetch: () => Promise<number> }> = [
    {
      source: 'gold-api.com', upstream: 'gold-api',
      fetch: async () => {
        const d = (await getJson('https://gold-api.com/api/price/XAU')) as { price?: number }
        if (!d.price) throw new Error('no price')
        return d.price
      },
    },
    {
      source: 'api.metals.live', upstream: 'metals-live',
      fetch: async () => {
        const d = (await getJson('https://api.metals.live/v1/spot/gold')) as Array<{ price?: number }>
        const p = Array.isArray(d) && d[0]?.price
        if (!p) throw new Error('no price')
        return p
      },
    },
    {
      source: 'metals.live', upstream: 'metals-live',
      fetch: async () => {
        const d = (await getJson('https://metals.live/api/spot')) as Array<{ metal: string; price?: number }>
        const g = Array.isArray(d) ? d.find((m) => m.metal === 'gold')?.price : undefined
        if (!g) throw new Error('no gold')
        return g
      },
    },
    {
      source: 'frankfurter', upstream: 'ecb',
      fetch: async () => {
        const d = (await getJson('https://api.frankfurter.dev/v2/rates?base=USD&quotes=XAU')) as
          | { rates?: { XAU?: number } }
          | Array<{ quote?: string; rate?: number }>
        let xau: number | undefined
        if (Array.isArray(d)) xau = d.find((r) => r.quote === 'XAU')?.rate
        else xau = d.rates?.XAU
        if (!xau || xau <= 0) throw new Error('no xau')
        return 1 / xau
      },
    },
  ]

  // GoldAPI.io (keyed) is a distinct upstream — added when configured, strengthens the consensus.
  const goldApiKey = process.env.GOLDAPI_IO_KEY
  if (goldApiKey) {
    providers.push({
      source: 'goldapi.io', upstream: 'goldapi',
      fetch: async () => {
        const res = await fetch('https://www.goldapi.io/api/XAU/USD', {
          signal: AbortSignal.timeout(6000),
          headers: { 'x-access-token': goldApiKey, 'user-agent': UA },
        })
        if (!res.ok) throw new Error(`goldapi ${res.status}`)
        const d = (await res.json()) as { price?: number }
        if (!d.price || d.price <= 0) throw new Error('no price')
        return d.price
      },
    })
  }

  const samples = []
  for (const p of providers) {
    try {
      const v = await p.fetch()
      if (v > 500 && v < 50000) samples.push({ value: v, source: p.source, upstream: p.upstream })
    } catch {
      /* provider down — skip */
    }
  }
  return priceConsensus(samples, 0.005).value
}

/** Official USD/EGP (the CBE-ish rate), used only as the Sagha-dollar sanity anchor. */
export async function fetchOfficialUsdEgp(): Promise<number | null> {
  try {
    const d = (await getJson('https://open.er-api.com/v6/latest/USD')) as { rates?: { EGP?: number } }
    const r = d.rates?.EGP
    return r && r > 20 && r < 200 ? r : null
  } catch {
    return null
  }
}

/** Fetch every Egypt Sagha source's raw HTML, keyed by id (null on failure — that source drops). */
export async function fetchEgyptSaghaHtml(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  await Promise.all(
    EGYPT_SAGHA_SOURCES.map(async (s) => {
      try {
        const res = await fetch(s.url, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': UA } })
        out[s.id] = res.ok ? await res.text() : null
      } catch {
        out[s.id] = null
      }
    }),
  )
  return out
}

export { TROY_OUNCE_GRAMS }
