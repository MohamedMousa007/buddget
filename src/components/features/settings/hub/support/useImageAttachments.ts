'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { beginNativeFlow, endNativeFlow } from '@/lib/native/appLockPolicy'
import { attachmentProblem, MAX_ATTACHMENTS, type Attachment } from '@/lib/support/attachments'
import { uploadSupportImage } from '@/lib/support/uploadAttachment'
import { useSupportCopy } from '@/lib/support/supportCopy'
import type { CarriedDraft } from './types'

export interface PickedImage {
  id: string
  preview: string
  uploaded: Attachment | null
  state: 'uploading' | 'ready' | 'failed'
}

/** Screenshots picked for one message: checked, uploaded straight away, previewed, removable. A carried draft starts it with its already-uploaded photos. */
export function useImageAttachments(seed?: Pick<CarriedDraft, 'attachments' | 'previews'>) {
  const copy = useSupportCopy()
  const [items, setItems] = useState<PickedImage[]>(() =>
    (seed?.attachments ?? []).map((a, i) => ({ id: crypto.randomUUID(), preview: seed?.previews[i] ?? '', uploaded: a, state: 'ready' as const })),
  )
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState<HTMLInputElement | null>(null)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  })
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), [])

  const add = useCallback(
    (files: FileList | null) => {
      setError(null)
      const list = Array.from(files ?? [])
      const room = MAX_ATTACHMENTS - itemsRef.current.length
      if (list.length > room) setError(copy.attachCount(MAX_ATTACHMENTS))
      for (const file of list.slice(0, Math.max(0, room))) {
        const problem = attachmentProblem(file)
        if (problem) {
          setError(problem === 'type' ? copy.attachType : copy.attachSize)
          continue
        }
        const id = crypto.randomUUID()
        setItems((prev) => [...prev, { id, preview: URL.createObjectURL(file), uploaded: null, state: 'uploading' }])
        void uploadSupportImage(file).then((uploaded) => {
          if (!uploaded) setError(copy.attachFailed)
          setItems((prev) => prev.map((i) => (i.id === id ? { ...i, uploaded, state: uploaded ? 'ready' : 'failed' } : i)))
        })
      }
    },
    [copy],
  )

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id)
      if (gone) URL.revokeObjectURL(gone.preview)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  /** Clears the strip after a send. The previews stay alive for the optimistic bubble, so they are not revoked here. */
  const reset = useCallback(() => {
    setItems([])
    setError(null)
  }, [])

  // The system photo picker hides the WebView without the person leaving the app: the app lock must not ask again.
  const pick = useCallback(() => {
    if (!input) return
    beginNativeFlow()
    let ended = false
    const end = () => {
      if (!ended) endNativeFlow()
      ended = true
    }
    input.addEventListener('change', end, { once: true })
    input.addEventListener('cancel', end, { once: true })
    window.addEventListener('focus', () => window.setTimeout(end, 1000), { once: true })
    input.click()
  }, [input])

  return {
    items,
    error,
    pick,
    add,
    remove,
    reset,
    /** Callback ref for the hidden file input. */
    bindInput: setInput,
    busy: items.some((i) => i.state === 'uploading'),
    ready: items.flatMap((i) => (i.uploaded ? [i.uploaded] : [])),
    full: items.length >= MAX_ATTACHMENTS,
  }
}

export type ImageAttachments = ReturnType<typeof useImageAttachments>
