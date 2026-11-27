'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { PaymentMethod } from '@/lib/store/types'
import type { ProviderFace } from '@/lib/accounts/providerGroups'
import { FACE_GAP, FACE_W, stackOffset } from '@/lib/accounts/cardFit'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { cn } from '@/lib/utils'
import { CardFaceChip } from './CardFaceChip'
import { cardKindLabel } from './accountDisplay'

/** Room on a 390pt phone (card width − 16px padding each side), the first guess before anything is measured. */
const FIRST_GUESS_ROOM = 324
/** A spread stack lays the faces out as a row: one face plus the row gap per step. */
const SPREAD_STEP = FACE_W + FACE_GAP

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** True when `n` faces and the dashed add slot fit side by side in `room` px; otherwise the faces stack. */
export function facesFitInRow(n: number, room: number): boolean {
  return (n + 1) * FACE_W + n * FACE_GAP <= room
}

/** The strip's own content width, kept current with a ResizeObserver. */
function useRoom() {
  const [room, setRoom] = useState(FIRST_GUESS_ROOM)
  const observer = useRef<ResizeObserver | null>(null)
  const measure = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    const read = () => setRoom(el.clientWidth || FIRST_GUESS_ROOM)
    read()
    observer.current = new ResizeObserver(read)
    observer.current.observe(el)
  }, [])
  useEffect(() => () => observer.current?.disconnect(), [])
  return { measure, room }
}

interface ProviderCardFacesProps {
  faces: ProviderFace[]
  /** "4 cards", the group's accessible name. */
  label: string
  /** The account each card hangs under, so the face names its bank. */
  parentOf: (face: ProviderFace) => PaymentMethod | undefined
  /** A face in a row or a spread stack opens that card (or, for a prepaid account, the account). */
  onFace: (face: ProviderFace) => void
  /** The dashed + slot after the faces adds a card here. */
  onAddCard: () => void
  /** No faces yet: the dashed slot with this caption ("Add a card"); without it an empty strip draws nothing. */
  emptyLabel?: string
}

/**
 * A provider's or an account's card faces (final UI v9), left-aligned and always LTR like the cards themselves.
 * While they fit, the faces sit in a row with the dashed + slot after them. Otherwise they stack (first card on top,
 * later ones tucked behind so their kind and digits show): the first tap spreads the stack, a tap on a spread face
 * opens its card. `CardFaceChip` is drawn unchanged.
 */
export function ProviderCardFaces({ faces, label, parentOf, onFace, onAddCard, emptyLabel }: ProviderCardFacesProps) {
  const t = useT().accountsPage
  const c = useAccountsLtCopy().v9
  const { measure, room } = useRoom()
  const [open, setOpen] = useState(false)
  const [peek, setPeek] = useState(() => stackOffset())
  const stackRef = useRef<HTMLDivElement>(null)
  const n = faces.length
  const stacked = n > 0 && !facesFitInRow(n, room)
  // Kind labels differ per language, so the visible strip is re-measured whenever the labels or the room change.
  const kinds = faces.map((f) => cardKindLabel(f.method.type, t)).join('|')

  useIsoLayoutEffect(() => {
    const el = stackRef.current
    if (!stacked || !el || n < 2) return
    let kindW = 0
    let digitsW = 0
    el.querySelectorAll<HTMLElement>('[data-face-index]').forEach((f) => {
      if (f.dataset.faceIndex === '0') return
      kindW = Math.max(kindW, f.querySelector<HTMLElement>('[data-slot=kind]')?.scrollWidth ?? 0)
      digitsW = Math.max(digitsW, f.querySelector<HTMLElement>('[data-slot=digits]')?.offsetWidth ?? 0)
    })
    const measured = kindW || digitsW ? stackOffset({ kindW, digitsW }) : stackOffset()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measures the drawn faces before paint
    setPeek(Math.max(0, Math.min(measured, Math.floor((room - SPREAD_STEP - FACE_W) / (n - 1)))))
  }, [stacked, n, room, kinds])

  const faceName = (f: ProviderFace) => [cardKindLabel(f.method.type, t), f.method.last4].filter(Boolean).join(' ')
  const slot = (
    <button type="button" onClick={onAddCard} aria-label={c.addACard} data-raw-button-ok="the dashed add-card slot, drawn as a card face"
      className="flex h-14 w-[88px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] text-[var(--color-brand-text-muted)] hover:bg-[var(--color-brand-elevated)]">
      <Plus className="size-5" aria-hidden />
    </button>
  )

  if (n === 0) {
    if (!emptyLabel) return null
    return (
      <div ref={measure} className="flex items-center gap-3">
        {slot}
        <span className="text-[0.78125rem] font-semibold text-[var(--color-brand-primary-ink)]">{emptyLabel}</span>
      </div>
    )
  }

  if (!stacked) {
    return (
      <div ref={measure} dir="ltr" role="group" aria-label={label} className="flex items-center gap-2 py-0.5">
        {faces.map((f) => (
          <button key={f.method.id} type="button" onClick={() => onFace(f)} aria-label={faceName(f)} data-raw-button-ok="a card face in a provider's card row" className="rounded-[7px]">
            <CardFaceChip method={f.method} parent={parentOf(f)} />
          </button>
        ))}
        {slot}
      </div>
    )
  }

  const step = open ? SPREAD_STEP : peek
  return (
    <div ref={measure}>
      <div dir="ltr" className="hide-scrollbar overflow-x-auto overflow-y-hidden pb-1 pt-0.5">
        <div ref={stackRef} role="group" aria-label={label} className="relative h-14" style={{ width: FACE_W + (n - 1) * step + SPREAD_STEP }}>
          {faces.map((f, i) => (
            <button key={f.method.id} type="button" data-face-index={i} data-raw-button-ok="a card face in a provider's card stack"
              tabIndex={open || i === 0 ? 0 : -1} aria-hidden={open || i === 0 ? undefined : true} aria-expanded={open ? undefined : false}
              aria-label={open ? faceName(f) : c.spreadCards}
              onClick={() => (open ? onFace(f) : setOpen(true))}
              className={cn('absolute left-0 top-0 rounded-[7px] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
                open ? '' : 'shadow-[var(--shadow-stack-edge)]')}
              style={{ transform: `translateX(${i * step}px)`, zIndex: n - i }}>
              <CardFaceChip method={f.method} parent={parentOf(f)} />
            </button>
          ))}
          <span className="absolute left-0 top-0 transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `translateX(${(n - 1) * step + SPREAD_STEP}px)` }}>{slot}</span>
        </div>
      </div>
    </div>
  )
}
