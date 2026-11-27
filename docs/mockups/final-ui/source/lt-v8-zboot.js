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
/* round 9: reset earlier New badges, mark this round's changes, and a switch for the in-screen badges */
{
  document.querySelectorAll('.pz-new').forEach((b) => b.remove())
  const keys = new Set(NEW9.flatMap((k) => [k, 'v8_' + k]))
  document.querySelectorAll('[data-sheet], [data-page]').forEach((b) => { if (keys.has(b.dataset.sheet || b.dataset.page)) b.insertAdjacentHTML('beforeend', '<span class="pz-new">New</span>') })
  const bar = document.getElementById('pz-sheets')?.closest('.pz-bar')
  if (bar) {
    bar.insertAdjacentHTML('afterend', '<div class="pz-bar"><span class="pz-label">In the phone</span><div class="pz-seg" role="group" aria-label="Show what is new" id="pz-new9"><button type="button" data-new9-set="on" aria-pressed="true">Show what’s new</button><button type="button" data-new9-set="off" aria-pressed="false">Hide</button></div></div>')
    const css = document.createElement('style')
    document.head.append(css)
    document.getElementById('pz-new9').addEventListener('click', (e) => {
      const b = e.target.closest('[data-new9-set]'); if (!b) return
      const on = b.dataset.new9Set === 'on'
      document.querySelectorAll('#pz-new9 button').forEach((x) => x.setAttribute('aria-pressed', x === b))
      css.textContent = on ? '' : '[data-new9]{display:none!important}'
    })
  }
}
