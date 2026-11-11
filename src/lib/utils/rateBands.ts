/** Units of each currency per 1 USD (XAU: troy ounces per USD) that a real provider could ever return. Anything outside is a bad payload. */
const BANDS: Record<string, readonly [number, number]> = {
  USD: [1, 1], AED: [3.6, 3.75], SAR: [3.7, 3.8], QAR: [3.5, 3.8], BHD: [0.37, 0.385], OMR: [0.38, 0.39], KWD: [0.25, 0.36], JOD: [0.7, 0.72],
  EGP: [10, 300], EUR: [0.5, 1.6], GBP: [0.4, 1.4], MAD: [5, 15], TND: [1.5, 6], XAU: [1e-5, 1e-2],
}

/** Keeps only finite, positive rates that sit inside their currency's plausibility band (unknown codes are kept). */
export function plausibleRates(rates: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(rates).filter(([code, v]) => {
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return false
      const band = BANDS[code]
      return !band || (v >= band[0] && v <= band[1])
    }),
  )
}
