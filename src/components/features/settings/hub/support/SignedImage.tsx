'use client'

import { useState } from 'react'

/**
 * A screenshot behind a short-lived signed link. Every poll mints a new link for the same file; the image keeps the
 * first one (no re-download each refresh) and only switches to the latest when the one it has stops loading.
 */
export function SignedImage({ src, className }: { src: string; className?: string }) {
  const [shown, setShown] = useState(src)
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a private signed URL, not an optimisable asset
    <img src={shown} alt="" loading="lazy" className={className} onError={() => { if (shown !== src) setShown(src) }} />
  )
}
