// Realistic device mockups in HTML/CSS. renderDevice(kind, imgDataUrl, widthPx) -> HTML string.
// Screen = status bar (drawn) + app capture. Proportions follow the real devices.
const K = {
  iphone:  { sw: 402, sh: 874, sb: 54, bezel: 0.034, rim: 0.012, rScreen: 0.137, rimColor: 'linear-gradient(135deg,#a9acb0,#6c6f74 40%,#b8bbbf 60%,#5f6267)', island: true, time: '9:41' },
  galaxy:  { sw: 360, sh: 780, sb: 24, bezel: 0.022, rim: 0.010, rScreen: 0.085, rimColor: 'linear-gradient(135deg,#4a4d52,#26282b 45%,#55585d 60%,#202225)', punch: true, time: '12:30' },
  ipad:    { sw: 1032, sh: 1376, sb: 24, bezel: 0.040, rim: 0.006, rScreen: 0.028, rimColor: 'linear-gradient(135deg,#b4b7bb,#7a7d82 50%,#c0c3c7)', time: '9:41', tablet: true },
  atablet: { sw: 800, sh: 1280, sb: 24, bezel: 0.036, rim: 0.007, rScreen: 0.030, rimColor: 'linear-gradient(135deg,#4a4d52,#26282b 50%,#55585d)', time: '12:30', tablet: true, cam: true },
}
const icons = (c, big, s) => {
  const h = (big ? 12 : 11) * s
  const sig = `<svg height="${h}" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="${c}"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="${c}"/><rect x="10" y="3" width="3" height="9" rx="1" fill="${c}"/><rect x="15" y="0" width="3" height="12" rx="1" fill="${c}"/></svg>`
  const wifi = `<svg height="${h}" viewBox="0 0 16 12"><path d="M8 11.5l2.3-2.6a3.3 3.3 0 0 0-4.6 0z" fill="${c}"/><path d="M2.6 5.9a7.7 7.7 0 0 1 10.8 0l-1.6 1.8a5.3 5.3 0 0 0-7.6 0z" fill="${c}"/><path d="M0 3.1a11.5 11.5 0 0 1 16 0l-1.6 1.8a9.1 9.1 0 0 0-12.8 0z" fill="${c}"/></svg>`
  const bat = `<svg height="${h}" viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.2" fill="none" stroke="${c}" opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2" fill="${c}"/><path d="M25 4v4a2 2 0 0 0 0-4z" fill="${c}" opacity=".45"/></svg>`
  return `${sig}${wifi}${bat}`
}
export function renderDevice(kind, img, W, statusBg = '#fff', statusFg = '#111') {
  const d = K[kind]
  const s = W / (d.sw * (1 + 2 * (d.bezel + d.rim))) // px per screen point
  const sw = d.sw * s, sh = d.sh * s, bz = d.sw * d.bezel * s, rm = d.sw * d.rim * s
  const rS = d.sw * d.rScreen * s, rB = rS + bz, rO = rB + rm
  const sb = d.sb * s
  const fs = (d.island ? 15 : 12.5) * s
  const statusPad = d.island ? sw * 0.085 : sw * 0.05
  const island = d.island ? `<div style="position:absolute;left:50%;top:${11 * s}px;width:${126 * s}px;height:${37 * s}px;transform:translateX(-50%);background:#000;border-radius:${20 * s}px"></div>` : ''
  const punch = d.punch ? `<div style="position:absolute;left:50%;top:${sb / 2}px;width:${11 * s}px;height:${11 * s}px;transform:translate(-50%,-50%);background:#050505;border-radius:50%;box-shadow:inset 0 0 ${2 * s}px #333"></div>` : ''
  const cam = d.cam ? `<div style="position:absolute;left:50%;top:${-bz / 2}px;width:${7 * s}px;height:${7 * s}px;transform:translate(-50%,-50%);background:#111;border-radius:50%;box-shadow:0 0 0 ${1.5 * s}px #222"></div>` : ''
  const tabletTime = d.tablet && !d.cam ? `${d.time}&nbsp;&nbsp;Fri 28 Nov` : d.time
  const btn = (side, top, h) => `<div style="position:absolute;${side}:${-rm * 0.9}px;top:${top * (sh + 2 * bz + 2 * rm)}px;width:${rm * 1.3}px;height:${h * (sh + 2 * bz + 2 * rm)}px;background:${d.rimColor};border-radius:${rm}px"></div>`
  const buttons = d.tablet ? '' : d.island
    ? btn('left', 0.17, 0.045) + btn('left', 0.25, 0.075) + btn('left', 0.345, 0.075) + btn('right', 0.27, 0.11) + btn('right', 0.56, 0.075)
    : btn('right', 0.2, 0.11) + btn('right', 0.35, 0.06)
  return `<div style="position:relative;width:${W}px;height:${sh + 2 * bz + 2 * rm}px;flex:none">
    ${buttons}
    <div style="position:absolute;inset:0;border-radius:${rO}px;background:${d.rimColor};padding:${rm}px;box-shadow:0 ${30 * s}px ${60 * s}px rgba(0,0,0,.35),0 ${6 * s}px ${14 * s}px rgba(0,0,0,.25)">
      <div style="position:relative;width:100%;height:100%;border-radius:${rB}px;background:#0a0a0a;padding:${bz}px">
        ${cam}
        <div style="position:relative;width:${sw}px;height:${sh}px;border-radius:${rS}px;overflow:hidden;background:${statusBg}">
          <div style="height:${sb}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${statusPad}px;color:${statusFg};font:600 ${fs}px/1 -apple-system,'SF Pro Text','Roboto','Inter',sans-serif;letter-spacing:.01em;direction:ltr">
            <span>${tabletTime}</span><span style="display:flex;gap:${5 * s}px;align-items:center">${icons(statusFg, d.island, s)}</span>
          </div>
          <img src="${img}" style="display:block;width:${sw}px;height:${sh - sb}px;object-fit:cover;object-position:top">
          ${island}${punch}
          ${d.island ? `<div style="position:absolute;left:50%;bottom:${8 * s}px;width:${134 * s}px;height:${5 * s}px;transform:translateX(-50%);background:rgba(0,0,0,.75);border-radius:${3 * s}px"></div>` : ''}
        </div>
      </div>
    </div>
  </div>`
}
