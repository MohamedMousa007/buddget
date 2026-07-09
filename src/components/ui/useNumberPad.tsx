'use client'

/**
 * useNumberPad — plumbing for the glass NumberPad: open state + the portalled
 * pad node. Lets a form keep its own field chrome (label, currency selector,
 * container border) and just swap the focusable <input> for a <button> that
 * opens the pad, so the OS keyboard never appears.
 *
 *   const { openPad, isOpen, pad } = useNumberPad({ value: amount, onChange: setAmt, currency })
 *   <button onClick={openPad} ...>{amount || '0.00'}</button>
 *   {pad}
 */

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NumberPad, type NumberPadMode } from '@/components/ui/NumberPad'

interface UseNumberPadOptions {
  value: string
  onChange: (next: string) => void
  mode?: NumberPadMode
  currency?: string
  label?: string
  dir?: 'ltr' | 'rtl'
}

export function useNumberPad({ value, onChange, mode, currency, label, dir }: UseNumberPadOptions) {
  const [isOpen, setOpen] = useState(false)

  const pad: ReactNode =
    isOpen && typeof document !== 'undefined'
      ? createPortal(
          <NumberPad
            value={value}
            onChange={onChange}
            mode={mode}
            currency={currency}
            label={label}
            dir={dir}
            showDisplay={false}
            onDone={() => setOpen(false)}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )
      : null

  return { isOpen, openPad: () => setOpen(true), closePad: () => setOpen(false), pad }
}
