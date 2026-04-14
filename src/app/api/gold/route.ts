import { NextResponse } from 'next/server'

const TROY_OUNCE_TO_GRAMS = 31.1035

interface GoldProvider {
  name: string
  fetch: () => Promise<number> // returns USD per troy ounce
}

const providers: GoldProvider[] = [
  {
    name: 'frankfurter.dev',
    fetch: async () => {
      const res = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=XAU', {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`frankfurter.dev ${res.status}`)
      const data = await res.json()
      let xauRate: number | undefined
      if (Array.isArray(data)) {
        const row = data.find((r: { quote?: string; rate?: number }) => r.quote === 'XAU')
        xauRate = row?.rate
      } else {
        const o = data as { data?: { rates?: { XAU?: number } }; rates?: { XAU?: number } }
        xauRate = o.data?.rates?.XAU ?? o.rates?.XAU
      }
      if (!xauRate || xauRate <= 0) throw new Error('No XAU in response')
      return 1 / xauRate
    },
  },
  {
    name: 'frankfurter.dev-pair',
    fetch: async () => {
      const res = await fetch('https://api.frankfurter.dev/v2/rate/USD/XAU', {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`frankfurter.dev-pair ${res.status}`)
      const data = await res.json()
      const rate = data.data?.rate ?? data.rate
      if (!rate || rate <= 0) throw new Error('No rate')
      return 1 / rate
    },
  },
  {
    name: 'metals.live',
    fetch: async () => {
      const res = await fetch('https://metals.live/api/spot', {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`metals.live ${res.status}`)
      const metals = await res.json()
      const gold = metals.find((m: { metal: string }) => m.metal === 'gold')
      if (!gold?.price) throw new Error('No gold in response')
      return gold.price
    },
  },
  {
    name: 'api.metals.live',
    fetch: async () => {
      const res = await fetch('https://api.metals.live/v1/spot/gold', {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`api.metals.live ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0 && data[0].price) return data[0].price
      throw new Error('No price')
    },
  },
  {
    name: 'gold-api.com',
    fetch: async () => {
      const res = await fetch('https://gold-api.com/api/price/XAU', {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`gold-api.com ${res.status}`)
      const data = await res.json()
      if (data.price) return data.price
      throw new Error('No price')
    },
  },
]

async function fetchGoldPriceUSD(): Promise<{ price: number; provider: string } | null> {
  const errors: string[] = []
  for (const provider of providers) {
    try {
      const price = await provider.fetch()
      if (price > 500 && price < 50000) {
        return { price, provider: provider.name }
      }
      errors.push(`${provider.name}: price ${price} out of range`)
    } catch (e) {
      errors.push(`${provider.name}: ${e instanceof Error ? e.message : 'unknown'}`)
      continue
    }
  }
  console.warn('[gold] All 5 providers failed:', errors.join(' | '))
  return null
}

async function fetchUsdToAed(): Promise<number> {
  const sources = [
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) throw new Error()
      const d = await r.json()
      return d.rates?.AED
    },
    async () => {
      const r = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&symbols=AED', {
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) throw new Error()
      const d = await r.json()
      return d.rates?.AED
    },
  ]

  for (const src of sources) {
    try {
      const rate = await src()
      if (rate && rate > 3 && rate < 4) return rate
    } catch {
      continue
    }
  }
  return 3.6725
}

export async function GET() {
  const [goldResult, usdToAed] = await Promise.all([
    fetchGoldPriceUSD(),
    fetchUsdToAed(),
  ])

  if (!goldResult) {
    return NextResponse.json(
      {
        error: 'Gold price temporarily unavailable',
        available: false,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  }

  const usdPerGram = goldResult.price / TROY_OUNCE_TO_GRAMS
  const aedPerGram = usdPerGram * usdToAed

  return NextResponse.json(
    {
      available: true,
      pricePerGram: aedPerGram,
      pricePerOunce: goldResult.price,
      currency: 'AED',
      usdPerGram,
      usdToAed,
      provider: goldResult.provider,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      },
    }
  )
}
