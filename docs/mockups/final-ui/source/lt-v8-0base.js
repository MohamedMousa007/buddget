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

/* ---------- round 9: what changed this round ----------
   NEW9.push('pageKey' | 'sheetKey') marks a bar button with a New badge (badges from earlier rounds are cleared).
   new9(html) puts a small New badge right after a changed part inside the final phone (shown while "Show what's new" is on). */
const NEW9 = []
const new9 = (html = '') => `${html}<span data-new9 class="ms-1.5 inline-flex h-[18px] shrink-0 items-center rounded-full bg-[var(--color-brand-primary)] px-1.5 align-middle text-[0.625rem] font-bold uppercase tracking-[0.04em] text-white">New</span>`
