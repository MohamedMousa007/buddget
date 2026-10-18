const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** 1,234.50 — digits are Latin in every locale (the money is `font-mono-numbers`). */
export const money2 = (n: number) => two.format(n)
/** 1,235 */
export const money0 = (n: number) => whole.format(n)
