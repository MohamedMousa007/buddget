import type { CSSProperties } from 'react'

/** Shared visual tokens for the sign-in modal (fintech dark). */

export const MIN_PASSWORD_LEN = 8

export const cardStyle: CSSProperties = {
  background: '#111118',
  borderColor: '#2A2A38',
  borderRadius: 16,
  maxWidth: 440,
}

export const inputClass =
  'w-full h-12 px-3 rounded-[10px] border text-white placeholder:text-[#5A5A72] outline-none transition-colors text-[15px]'

export const inputStyle: CSSProperties = {
  background: '#1A1A24',
  borderColor: '#2A2A38',
}

export const inputFocus = 'focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914]'

export const primaryBtn =
  'w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
