/* ================= round 8 boot ================= */
for (const k of Object.keys(P8)) {
  if (k === 'flow') continue
  const old = PAGES[k]
  PAGES[k] = (st, L) => (st.v7 && old ? old(st, L) : P8[k](st))
}
if (P8.flow) { const pm = pageM; pageM = (st) => (st.v7 ? pm(st) : P8.flow(st, pm(st))) }
Object.assign(LT_NOTES, NOTES8)
for (const [k] of SHEETS8) AFTER['v8_' + k] = (S) => (S.st.v7 ? (T8[k] ? T8[k](S) : toast(S, 'New in the final design')) : F8[k](S))
{
  const bar = document.getElementById('pz-sheets')
  if (bar) bar.innerHTML = SHEETS8.map(([k, l]) => `<button type="button" data-sheet="v8_${k}">${l}</button>`).join('')
}
/* Final phone uses the new card faces everywhere (Flow, Debts, v7 sheets opened on it). */
let FINAL8 = false
{
  const r0 = render, m0 = mini
  render = (S) => { const was = FINAL8; FINAL8 = !S.st.v7; try { return r0(S) } finally { FINAL8 = was } }
  mini = (k, sel) => (FINAL8 && window.FACE8 ? FACE8.mini(k, sel) : m0(k, sel))
  for (const k of Object.keys(AFTER)) { const a = AFTER[k]; AFTER[k] = (S, ...x) => { const was = FINAL8; FINAL8 = !S.st.v7; try { return a(S, ...x) } finally { FINAL8 = was } } }
}
