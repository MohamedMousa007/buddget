'use client'

import { useEffect, useRef, useState } from 'react'
import type { SiteLocale } from '@/lib/site/config'
import { siteContent } from '@/lib/site/routes'
import { CardBand, CardGoal, CardTx } from './AppCards'
import { nf } from './format'
import { smsNode } from './HomeHero'

const R = 200
const C = 2 * Math.PI * R
const GAP = 3
const SEGS: [number, string][] = [[8000, '#389BD9'], [4619, '#E5684D'], [3634, '#8B5CF6']]
const TOTAL = 24500
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

type Pos = { s: number; t: number }

function Ring2({ t, plan }: { t: number; plan: string }) {
  const arcs = SEGS.map(([v, color], i) => {
    const pos = SEGS.slice(0, i).reduce((sum, [x]) => sum + (x / TOTAL) * C, 0)
    const k = clamp01(t * 3.2 - i * 0.9)
    const len = (v / TOTAL) * C * k
    return len > 0 ? <circle key={i} className="arc" cx="260" cy="260" r={R} stroke={color} strokeDasharray={`${Math.max(0, len - GAP).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-pos).toFixed(1)} /> : null
  })
  const k2 = clamp01((t - 0.7) / 0.3)
  const rem = ((TOTAL - 16253) / TOTAL) * C * k2
  const n = Math.round(8247 * clamp01((t - 0.55) / 0.45))
  return (
    <div className="ring2">
      <svg viewBox="0 0 520 520" aria-hidden="true">
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2
          const lg = i % 5 === 0
          return <line key={i} x1={(260 + Math.sin(a) * 236).toFixed(1)} y1={(260 - Math.cos(a) * 236).toFixed(1)} x2={(260 + Math.sin(a) * (lg ? 252 : 245)).toFixed(1)} y2={(260 - Math.cos(a) * (lg ? 252 : 245)).toFixed(1)} className={lg ? 'tk lg' : 'tk'} strokeWidth={lg ? 3 : 2} strokeLinecap="round" />
        })}
        <circle cx="260" cy="260" r={R} className="track" strokeWidth="30" />
        <g transform="rotate(-90 260 260)">
          {arcs}
          {k2 > 0 ? <circle className="arc rem" cx="260" cy="260" r={R} stroke="#1FC3B2" strokeDasharray={`${Math.max(0, rem - GAP).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-(16253 / TOTAL) * C).toFixed(1)} /> : null}
        </g>
      </svg>
      <div className="core"><small>{plan}</small><span className="big num">{t < 0.55 ? '–' : nf(n)}</span></div>
    </div>
  )
}

/** Pinned four-step story. Real app pieces appear only as the result of each step. */
export function HomeStory({ locale }: { locale: SiteLocale }) {
  const c = siteContent[locale]
  const st = c.landing.story
  const ref = useRef<HTMLElement>(null)
  const [p, setP] = useState<Pos>({ s: 0, t: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const vh = window.innerHeight
      const r = el.getBoundingClientRect()
      const total = el.offsetHeight - vh
      const prog = Math.max(0, Math.min(0.9999, -r.top / total))
      const s = Math.floor(prog * 4)
      const t = Math.round((prog * 4 - s) * 100) / 100
      setP((o) => (o.s === s && Math.abs(o.t - t) < 0.01 ? o : { s, t }))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame) }
  }, [])

  const { s, t } = p
  const ar = locale === 'ar'
  const merchants: [string, string][] = ar ? [['245.00', 'طلبات'], ['148.00', 'صيدلية']] : [['245.00', 'TALABAT'], ['148.00', 'PHARMACY']]
  const legendColors = ['#389BD9', '#E5684D', '#8B5CF6', '#1FC3B2']
  const bubbles = st.chat

  return (
    <section ref={ref} className="story" id="story" aria-label={st.label}>
      <div className="story-stick">
        <div className="wrap story-grid">
          <div className="copy">
            {st.steps.map((x, i) => (
              <div key={x.h} className={`step${s === i ? ' on' : ''}`} aria-hidden={s !== i}>
                <h2>{x.h}</h2>
                <p>{x.p}</p>
              </div>
            ))}
          </div>
          <div className="scene">
            <div className={`sc${s === 0 ? ' on' : ''}`} aria-hidden={s !== 0}>
              <div className="sms-s">
                {merchants.map((m, i) => (
                  <div key={m[1]} className={`sms-row${s === 0 && t > i * 0.38 + 0.04 ? ' on' : ''}${s === 0 && t > i * 0.38 + 0.2 ? ' parsed' : ''}`}>
                    <div className="sms"><b><span>CIB</span><span>{c.landing.hero.ago}</span></b>{smsNode(c.landing.hero.sms, m[0], m[1])}</div>
                    <CardTx index={i as 0 | 1} locale={locale} />
                  </div>
                ))}
              </div>
            </div>
            <div className={`sc${s === 1 ? ' on' : ''}`} aria-hidden={s !== 1}>
              <div className="maths">
                <Ring2 t={s === 1 ? t : s > 1 ? 1 : 0} plan={st.plan} />
                <div className="legend">{st.legend.map((l, i) => <span key={l}><i style={{ background: legendColors[i] }} />{l}</span>)}</div>
                <div className={`band-shot${s === 1 && t > 0.78 ? ' on' : ''}`}><CardBand locale={locale} /></div>
              </div>
            </div>
            <div className={`sc${s === 2 ? ' on' : ''}`} aria-hidden={s !== 2}>
              <div className="goals-s">
                {[0, 1].map((i) => <div key={i} className={`gw${s === 2 && t > i * 0.22 + 0.03 ? ' on' : ''}`}><CardGoal index={i as 0 | 1} locale={locale} /></div>)}
              </div>
            </div>
            <div className={`sc${s === 3 ? ' on' : ''}`} aria-hidden={s !== 3}>
              <div className="chat">
                {bubbles.map((b, i) => <div key={i} className={`b ${b.who}${s === 3 && t > i * 0.17 + 0.02 ? ' on' : ''}`}>{b.text}</div>)}
                <div className={`b a done${s === 3 && t > 4 * 0.17 + 0.02 ? ' on' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#1FC3B2" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeWidth="1.6" /><path d="M7.5 12.5 11 16l5.5-6" /></svg>
                  {st.chatDone}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="chap"><ol>{st.chap.map((x, i) => <li key={x} className={s === i ? 'on' : undefined}>{x}</li>)}</ol></div>
      </div>
    </section>
  )
}
