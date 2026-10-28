'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SiteLocale } from '@/lib/site/config'
import { pathFor, siteContent } from '@/lib/site/routes'
import { BuddgyFace, type FaceMood } from './BuddgyFace'
import { fill, nf } from './format'

const LEFT = 8247
const DAYS = 12

/** "Can you afford it?" Checks a price against what is left of the month, using the same demo numbers as the hero. */
export function HomeAfford({ locale }: { locale: SiteLocale }) {
  const a = siteContent[locale].landing.afford
  const [price, setPrice] = useState(a.items[0].price)

  const per = LEFT / DAYS
  const after = (LEFT - price) / DAYS
  const share = price / LEFT
  const perWeek = price / 8

  let mood: FaceMood = 'awake'
  let verdict = a.v0
  let color = '#0D8578'
  if (price > 0) {
    if (share <= 0.08) { mood = 'happy'; verdict = a.v1 }
    else if (share <= 0.25) { mood = 'curious'; verdict = a.v2 }
    else if (share <= 0.6) { mood = 'worried'; verdict = a.v3; color = '#B7791F' }
    else { mood = 'alert'; verdict = a.v4; color = '#C2442B' }
  }
  const body = fill(verdict.p, { s: Math.round(share * 100), w: nf(perWeek) })

  return (
    <section className="you sec tone-light band" id="afford">
      <div className="wrap">
        <h2 className="h2">{a.h2}</h2>
        <p className="sub">{a.p}</p>
        <div className="you-grid">
          <div>
            <div className="who" role="group" aria-label={a.hint}>
              {a.items.map((it) => (
                <button key={it.label} type="button" aria-pressed={price === it.price} onClick={() => setPrice(it.price)}>
                  {it.label} <span className="num" style={{ opacity: 0.7, fontSize: 13 }}>{nf(it.price)}</span>
                </button>
              ))}
            </div>
            <div className="aff-in">
              <label htmlFor="aff-price">{a.custom}</label>
              <input id="aff-price" type="number" min={0} step={50} inputMode="numeric" value={price || ''} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <p className="who-note">{a.note}</p>
          </div>
          <div className="calc" aria-live="polite">
            <div className="aff-top">
              <span className="aff-bud"><BuddgyFace mood={mood} size={46} shell="#0D1A18" track={false} /></span>
              <div><h3 style={{ color }}>{verdict.h}</h3><p>{body}</p></div>
            </div>
            <div className="aff-nums">
              <div><small>{a.before}</small><b className="num">{nf(per)}</b></div>
              <div className="aff-arrow" aria-hidden>{locale === 'ar' ? '←' : '→'}</div>
              <div><small>{a.after}</small><b className="num" style={{ color }}>{after < 0 ? `−${nf(-after)}` : nf(after)}</b></div>
            </div>
            <div className="aff-bar" role="img" aria-label={`${Math.round(Math.min(share, 1) * 100)}%`}><i style={{ width: `${Math.min(100, share * 100)}%`, background: color }} /></div>
            <div className="aff-cap"><span>{fill(a.share, { s: Math.round(share * 100) })}</span><span>{fill(a.days, { d: (price / per).toFixed(1) })}</span></div>
            <Link className="pill pill-p" href={pathFor(locale, 'download')} data-track="cta">{a.cta}</Link>
            <p className="calc-note">{a.foot}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
