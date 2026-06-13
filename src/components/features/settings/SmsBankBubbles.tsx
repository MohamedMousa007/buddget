'use client'

import { useEffect } from 'react'

const BUBBLE_KF = `
@keyframes sm-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes sm-pop   { from{opacity:0;transform:scale(.75) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
`

function useBubbleKf() {
  useEffect(() => {
    if (document.getElementById('sm-bank-bubbles-kf')) return
    const el = document.createElement('style')
    el.id = 'sm-bank-bubbles-kf'
    el.textContent = BUBBLE_KF
    document.head.appendChild(el)
  }, [])
}

const BANKS = [
  { name: 'CIB Egypt', badge: '🏦' },
  { name: 'Banque Misr', badge: '🏦' },
  { name: 'NBE', badge: '🏦' },
  { name: 'QNB Alahli', badge: '🏦' },
  { name: 'HSBC Egypt', badge: '🏦' },
  { name: 'Alex Bank', badge: '🏦' },
  { name: 'Std. Chartered', badge: '🏦' },
  { name: 'Fawry', badge: '🧾' },
  { name: 'InstaPay', badge: '⚡' },
  { name: 'Vodafone Cash', badge: '📱' },
  { name: 'Orange Money', badge: '📱' },
  { name: 'e& Money', badge: '📱' },
  { name: 'ValU', badge: '📅' },
  { name: 'Sympl', badge: '📅' },
  { name: 'Amazon Egypt', badge: '🌐' },
  { name: 'Uber Egypt', badge: '🚗' },
]

export function SmsBankBubbles() {
  useBubbleKf()
  return (
    <div className="pt-5 px-1 pb-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-brand-text-muted)] mb-3 px-1">
        Supported Banks &amp; Services
      </p>
      <div className="flex flex-wrap gap-2">
        {BANKS.map((b, i) => (
          <div
            key={b.name}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-brand-text-secondary)] select-none"
            style={{
              animation: `sm-pop .38s cubic-bezier(.34,1.56,.64,1) ${i * 55}ms both, sm-float ${3.8 + (i % 4) * 0.4}s ease-in-out ${i * 0.28}s infinite`,
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>{b.badge}</span>
            {b.name}
          </div>
        ))}
      </div>
    </div>
  )
}
