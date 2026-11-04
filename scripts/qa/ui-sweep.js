window.__qaSweep = async function (opts) {
  opts = opts || {}; const d = document, w = window; const res = { path: location.pathname };
  try {
    if (!w.axe) await new Promise((ok, bad) => { const s = d.createElement('script'); s.src = '/qa-axe.min.js'; const n = [...d.scripts].find(x => x.nonce); if (n) { s.setAttribute('nonce', n.nonce); } s.onload = ok; s.onerror = () => bad('axe load'); d.head.appendChild(s); setTimeout(() => bad('axe timeout'), 8000); });
    const ax = await w.axe.run(d, { resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] } });
    res.axe = ax.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 2).map(n => n.target.join(' ').slice(0, 80)) }));
  } catch (e) { res.axeErr = String(e); }
  const vw = w.innerWidth;
  res.hscroll = d.documentElement.scrollWidth - vw;
  res.wide = [...d.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[aria-hidden="true"],[hidden],.sr-only,[inert]') }).slice(0, 4).map(el => el.tagName + '.' + String(el.className).slice(0, 40) + ' ' + Math.round(el.getBoundingClientRect().right));
  const inter = [...d.querySelectorAll('a[href],button,[role=button],[role=tab],input:not([type=hidden]),select,textarea,[role=switch],[role=checkbox]')].filter(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.disabled && !el.closest('[inert],[aria-hidden="true"]') });
  res.interactive = inter.length;
  const small = inter.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44 });
  const vh = w.innerHeight;
  const hitFail = small.filter(el => { const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cy < 0 || cy > vh) return false; const probes = [[cx - 21.5, cy], [cx + 21.5, cy], [cx, cy - 21.5], [cx, cy + 21.5]]; return probes.some(([x, y]) => { if (x < 0 || x > vw || y < 0 || y > vh) return false; const t = d.elementFromPoint(x, y); if (!t) return false; if (el.contains(t) || t.contains(el)) return false; const c = t.closest('a[href],button,[role=button],[role=tab],input,select,textarea,[role=switch],[role=checkbox]'); return !c ? 'dead' : 'other'; }); });
  res.smallCount = small.length; res.hitFailCount = hitFail.length;
  res.hitFail = hitFail.slice(0, 12).map(el => { const r = el.getBoundingClientRect(); return (el.getAttribute('aria-label') || el.textContent.trim().slice(0, 16) || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) });
  res.unnamed = inter.filter(el => !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent.trim() || el.getAttribute('title') || el.getAttribute('placeholder') || (el.labels && el.labels.length) || el.querySelector('img[alt]:not([alt=""])'))).slice(0, 4).map(el => el.outerHTML.slice(0, 100));
  res.h1 = [...d.querySelectorAll('h1')].filter(h => h.getBoundingClientRect().height > 0).length;
  res.imgNoAlt = d.querySelectorAll('img:not([alt])').length;
  res.text = d.body.innerText.slice(0, 70).replace(/\n/g, ' | ');
  res.bg = getComputedStyle(d.body).backgroundColor;
  return res;
};
