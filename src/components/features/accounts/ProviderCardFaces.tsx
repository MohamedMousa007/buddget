'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PaymentMethod } from '@/lib/store/types'
import type { ProviderFace } from '@/lib/accounts/providerGroups'
import { FACE_GAP, FACE_W, fitsInRow, stackOffset } from '@/lib/accounts/cardFit'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CardFaceChip } from './CardFaceChip'
import { cardKindLabel } from './accountDisplay'

/** Room on a 390pt phone (card width − 16px padding each side), the first guess before anything is measured. */
const FIRST_GUESS_ROOM = 324
/** A spread stack lays the faces out as a row: one face plus the row gap per step. */
const SPREAD_STEP = FACE_W + FACE_GAP

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Width of the "N cards" label as drawn (text-xs, semibold), in the element's own font. */
function labelWidth(el: HTMLElement, text: string): number {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return 0
  ctx.font = `600 12px ${getComputedStyle(el).fontFamily}`
  return Math.ceil(ctx.measureText(text).width)
}

/**
 * Row or stack for a provider card: measures the card's content width (ResizeObserver) and the label, then asks
 * `fitsInRow`. Attach `measure` (a callback ref) to an element that spans the card's padded content box in both modes.
 */
export function useFacesFit(count: number, label: string) {
  const [box, setBox] = useState<{ room: number; labelW: number } | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const measure = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    const read = () => setBox({ room: el.clientWidth, labelW: labelWidth(el, label) })
    read()
    observer.current = new ResizeObserver(read)
    observer.current.observe(el)
  }, [label])
  useEffect(() => () => observer.current?.disconnect(), [])
  const room = box?.room ?? FIRST_GUESS_ROOM
  return { measure, room, stacked: count > 0 && !fitsInRow(count, box?.labelW ?? 0, room) }
}

interface ProviderCardFacesProps {
  faces: ProviderFace[]
  /** "4 cards". */
  label: string
  /** The account each card hangs under, so the face names its bank. */
  parentOf: (face: ProviderFace) => PaymentMethod | undefined
  layout: 'row' | 'stack'
  /** Measured content width; the stack offset shrinks to stay inside it. */
  room: number
  /** Stack mode: a face in a spread stack opens that card (or, for a prepaid account, the account). */
  onFace?: (face: ProviderFace) => void
}

/**
 * The provider card's faces. Row: every face side by side, inert (the whole card is the button). Stack: the first card
 * on top at the left, later cards tucked behind and offset right so their kind label and digits still show; "Show
 * all" spreads them (transform only) and a spread face opens its card. `CardFaceChip` is drawn unchanged.
 */
export function ProviderCardFaces({ faces, label, parentOf, layout, room, onFace }: ProviderCardFacesProps) {
  const t = useT().accountsPage
  const [open, setOpen] = useState(false)
  const [peek, setPeek] = useState(() => stackOffset())
  const stackRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const n = faces.length
  // Kind labels differ per language, so the visible strip is re-measured whenever the labels or the room change.
  const kinds = faces.map((f) => cardKindLabel(f.method.type, t)).join('|')

  useIsoLayoutEffect(() => {
    const el = stackRef.current
    if (layout !== 'stack' || !el || n < 2) return
    let kindW = 0
    let digitsW = 0
    el.querySelectorAll<HTMLElement>('[data-face-index]').forEach((f) => {
      if (f.dataset.faceIndex === '0') return
      kindW = Math.max(kindW, f.querySelector<HTMLElement>('[data-slot=kind]')?.scrollWidth ?? 0)
      digitsW = Math.max(digitsW, f.querySelector<HTMLElement>('[data-slot=digits]')?.offsetWidth ?? 0)
    })
    const measured = kindW || digitsW ? stackOffset({ kindW, digitsW }) : stackOffset()
    setPeek(Math.max(0, Math.min(measured, Math.floor((room - FACE_W) / (n - 1)))))
  }, [layout, n, room, kinds])

  if (n === 0) return null

  if (layout === 'row') {
    return (
      <span dir="ltr" className="flex items-center gap-2 overflow-hidden py-0.5">
        {faces.map((f) => <CardFaceChip key={f.method.id} method={f.method} parent={parentOf(f)} />)}
        <span className="ms-auto flex-none whitespace-nowrap text-xs font-semibold text-[var(--color-brand-text-muted)]">{label}</span>
      </span>
    )
  }

  const step = open ? SPREAD_STEP : peek
  const toggle = () => {
    // Folding a spread stack that was scrolled sideways brings the first card back into view.
    if (open) scrollRef.current?.scrollTo({ left: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    setOpen(!open)
  }
  return (
    <div>
      <div ref={scrollRef} dir="ltr" className="hide-scrollbar overflow-x-auto overflow-y-hidden pb-1 pt-0.5">
        <div ref={stackRef} role="group" aria-label={label} className="relative h-14" style={{ width: FACE_W + (n - 1) * step }}>
          {faces.map((f, i) => (
            <button key={f.method.id} type="button" data-face-index={i} data-raw-button-ok="a card face in a provider's card stack"
              tabIndex={open ? 0 : -1} aria-hidden={open ? undefined : true}
              aria-label={[cardKindLabel(f.method.type, t), f.method.last4].filter(Boolean).join(' ')}
              onClick={() => (open ? onFace?.(f) : setOpen(true))}
              className={cn('absolute left-0 top-0 rounded-[7px] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
                open ? '' : 'shadow-[var(--shadow-stack-edge)]')}
              style={{ transform: `translateX(${i * step}px)`, zIndex: n - i }}>
              <CardFaceChip method={f.method} parent={parentOf(f)} />
            </button>
          ))}
        </div>
      </div>
      <button type="button" aria-expanded={open} onClick={toggle} data-raw-button-ok="the stack's caption row, a whole-row toggle"
        className="mt-0.5 flex min-h-11 w-full items-center justify-between gap-2 px-0.5 text-start">
        <span className="whitespace-nowrap text-xs font-semibold text-[var(--color-brand-text-muted)]">{label}</span>
        <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">
          {open ? t.showLess : t.showAll}
          <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200 ease-out motion-reduce:transition-none', open && 'rotate-180')} />
        </span>
      </button>
    </div>
  )
}
