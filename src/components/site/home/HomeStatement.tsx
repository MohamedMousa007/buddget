'use client'

import { useEffect, useRef } from 'react'

/** Words light up as the statement scrolls through the viewport. */
export function HomeStatement({ parts, label }: { parts: { text: string; hl?: boolean }[]; label: string }) {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const words = Array.from(el.querySelectorAll<HTMLElement>('.w'))
    let frame = 0
    const update = () => {
      frame = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.35)))
      const n = Math.round(p * words.length)
      words.forEach((w, i) => w.classList.toggle('on', i < n))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame) }
  }, [])

  return (
    <section className="state" aria-label={label}>
      <div className="wrap">
        <p ref={ref}>
          {parts.flatMap((p, i) => p.text.split(' ').map((w, j) => <span key={`${i}-${j}`} className={`w${p.hl ? ' hl' : ''}`}>{w}{' '}</span>))}
        </p>
      </div>
    </section>
  )
}
