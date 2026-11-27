/* ================= round 8 (final UI): shared base ================= */
/* Left phone = today's light-touch app (st.v7 true). Right phone = the final design.
   P8[page](st) returns the final page HTML (P8.flow(st, todayFlowHtml) for Flow).
   F8[key](S) opens a final sheet; T8[key](S) opens the today equivalent (optional).
   SHEETS8.push([key, label]) adds a button to the "Open a sheet" bar. NOTES8[page] = note under the final phone. */
const P8 = {}
const F8 = {}
const T8 = {}
const SHEETS8 = []
const NOTES8 = {}
const screenOf = (el) => Object.values(screens).find((x) => x.vp.contains(el))
/* D1 hero rule: full figure while it fits, no decimals past 7 digits, compact from 10M (282.9M). */
function fit8(n) {
  const a = Math.abs(n)
  if (a < 1e7) return f0(n)
  const [d, u] = a >= 1e9 ? [1e9, 'B'] : [1e6, 'M']
  return `${(n / d).toFixed(1).replace(/\.0$/, '')}${u}`
}
