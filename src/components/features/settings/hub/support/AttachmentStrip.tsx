'use client'

import { AlertCircle, Loader2, X } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { ATTACHMENT_TYPES } from '@/lib/support/attachments'
import { useSupportCopy } from '@/lib/support/supportCopy'
import type { ImageAttachments } from './useImageAttachments'

const ACCEPT = Object.keys(ATTACHMENT_TYPES).join(',')

/** The hidden picker plus a row of picked screenshots, each removable, with its upload state on it. */
export function AttachmentStrip({ att }: { att: ImageAttachments }) {
  const copy = useSupportCopy()
  const { bindInput, items, error, add, remove } = att
  return (
    <>
      <input ref={bindInput} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      {items.length ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item, i) => (
            <li key={item.id} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--color-brand-elevated)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset */}
              <img src={item.preview} alt="" className="size-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
              {item.state !== 'ready' ? (
                <span className="absolute inset-0 grid place-items-center bg-black/40 text-white" aria-hidden>
                  {item.state === 'uploading' ? <Loader2 className="size-5 animate-spin" /> : <AlertCircle className="size-5" />}
                </span>
              ) : null}
              <IconButton variant="overlay" size="sm" shape="round" className="absolute end-0.5 top-0.5 size-6" aria-label={copy.removeAttachment(i + 1)} onClick={() => remove(item.id)}>
                <X className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="text-xs text-[var(--color-brand-red)]">{error}</p> : null}
    </>
  )
}
