'use client'

export interface AuthModalBrandingProps {
  message: string | null
}

/**
 * Buddget wordmark and optional contextual message above the form.
 */
export function AuthModalBranding({ message }: AuthModalBrandingProps) {
  return (
    <div className="text-center mb-6">
      <h1
        id="auth-modal-title"
        className="text-2xl font-extrabold tracking-tight"
        style={{ fontFamily: 'var(--font-heading), var(--font-sans)' }}
      >
        <span className="text-white">Bud</span>
        <span className="text-[#E50914]">d</span>
        <span className="text-white">get</span>
      </h1>
      <p className="text-sm mt-1 text-[#5A5A72]">Your money, finally makes sense</p>
      {message ? (
        <p className="mt-3 text-sm text-left rounded-lg border border-[#E50914]/35 bg-[#E50914]/10 text-[#fecaca] px-3 py-2 leading-snug">
          {message}
        </p>
      ) : null}
    </div>
  )
}
