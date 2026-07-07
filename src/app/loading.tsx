'use client'

import { useT } from '@/lib/i18n'

// Same fixed neutral brand canvas as the sign-in gate (LandingGate .lg-bg) —
// identical in light and dark, so the boot experience never flashes a theme.
const NEUTRAL_BG =
  'radial-gradient(120% 60% at 50% -6%, rgba(229,9,20,.26) 0%, rgba(229,9,20,.06) 38%, rgba(20,18,26,0) 62%), ' +
  'linear-gradient(180deg, #1A1720 0%, #121016 55%, #0E0C12 100%)'

export default function Loading() {
  const t = useT()
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 px-4"
      style={{ background: NEUTRAL_BG }}
    >
      <div className="h-10 w-10 rounded-full border-2 border-white/15 border-t-[#E50914] animate-spin" />
      <p className="text-sm text-white/60">{t.dashboard.loadingMessage}</p>
    </div>
  )
}
