import { NextResponse } from 'next/server'

const TROY_OUNCE_TO_GRAMS = 31.1035

export async function GET() {
  try {
    const res = await fetch('https://metals.live/api/spot', {
      next: { revalidate: 1800 }, // cache for 30 minutes
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch gold price' },
        { status: res.status }
      )
    }

    const metals = await res.json()
    const gold = metals.find((m: { metal: string }) => m.metal === 'gold')

    if (!gold) {
      return NextResponse.json(
        { error: 'Gold price not found' },
        { status: 404 }
      )
    }

    const usdPerOunce = gold.price
    const usdPerGram = usdPerOunce / TROY_OUNCE_TO_GRAMS

    // Fetch USD to AED rate
    let usdToAed = 3.6725 // fallback
    try {
      const ratesRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=AED', {
        signal: AbortSignal.timeout(5000),
      })
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json()
        if (ratesData.rates?.AED) {
          usdToAed = ratesData.rates.AED
        }
      }
    } catch {
      // Use fallback rate
    }

    const aedPerGram = usdPerGram * usdToAed

    return NextResponse.json({
      pricePerGram: aedPerGram,
      pricePerOunce: usdPerOunce,
      currency: 'AED',
      usdPerGram,
      usdToAed,
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch gold price' },
      { status: 500 }
    )
  }
}
