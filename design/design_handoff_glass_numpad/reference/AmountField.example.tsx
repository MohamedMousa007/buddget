'use client'

/**
 * AmountField — example wiring of NumberPad into a money input.
 *
 * The core rule: DO NOT use a focusable <input> for the amount. A native input
 * summons the OS keyboard, which is exactly what this pad replaces. Use a
 * <button> that renders the current value and opens the pad. Repeat this
 * pattern for every numeric money field (income, debt, savings, budget) and,
 * with mode="pin", for card last-4 entry.
 *
 * Render the pad through a portal so its position:fixed sheet escapes any
 * transformed / overflow-hidden ancestor (modals, sheets).
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NumberPad } from './NumberPad'

interface AmountFieldProps {
  value: string
  currency: string
  onChange: (next: string) => void
}

export function AmountField({ value, currency, onChange }: AmountFieldProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <style>{`@keyframes npBlink { 0%,50% { opacity:1 } 51%,100% { opacity:0 } }`}</style>

      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          height: 52,
          background: '#16161f',
          border: `1px solid ${open ? '#E50914' : '#26262f'}`, // red focus ring while the pad is open
          borderRadius: 14,
          padding: '0 14px',
          cursor: 'pointer',
          transition: 'border-color .15s',
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 18, color: '#5A5A72' }}>{currency}</span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'start',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 24,
            letterSpacing: '-0.02em',
            color: value ? '#fff' : '#3F3F4D', // muted placeholder colour
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value || '0.00'}
        </span>
        {/* Blinking caret — only while the pad is open */}
        <span
          style={{
            width: 2,
            height: 26,
            borderRadius: 2,
            background: '#E50914',
            display: open ? 'block' : 'none',
            animation: 'npBlink 1.1s steps(1) infinite',
          }}
        />
      </button>

      {open &&
        createPortal(
          <NumberPad
            value={value}
            currency={currency}
            mode="decimal"
            showDisplay={false}   // the field above already shows the number
            onChange={onChange}   // types straight into the field, live
            onDone={() => setOpen(false)}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  )
}
