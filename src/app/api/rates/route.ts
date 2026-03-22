import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=AED,EGP,EUR,GBP,SAR',
      {
        next: { revalidate: 14400 }, // cache for 4 hours
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch rates' },
        { status: res.status }
      )
    }

    const data = await res.json()

    const rates: Record<string, number> = {}
    if (data.rates) {
      for (const [currency, rate] of Object.entries(data.rates)) {
        rates[`USD_${currency}`] = rate as number
      }

      if (data.rates.AED) {
        const usdToAed = data.rates.AED as number
        for (const [currency, rate] of Object.entries(data.rates)) {
          if (currency !== 'AED') {
            rates[`${currency}_AED`] = usdToAed / (rate as number)
          }
        }
        rates['USD_AED'] = usdToAed
      }
    }

    return NextResponse.json({
      rates,
      base: data.base,
      date: data.date,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 500 }
    )
  }
}
