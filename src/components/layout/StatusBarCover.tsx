'use client'

/**
 * Paints the status-bar strip (the top safe-area inset) on pages that own their header,
 * so content scrolling under it never shows through. `background` switches with the page —
 * Flow turns it teal together with its sticky strip (200 ms).
 */
export function StatusBarCover({ background }: { background: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[46] h-[env(safe-area-inset-top,0px)] lg:hidden"
      style={{ background, transition: 'background 200ms ease-out' }}
    />
  )
}
