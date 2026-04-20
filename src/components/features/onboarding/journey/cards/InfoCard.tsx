'use client'

import { useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n/types'
import type { InfoCard as InfoCardModel } from '@/lib/onboarding/journeyTypes'

/**
 * Pure hook/explain card. No input — renders a title and optional body, and
 * the runner's Next button handles advance. Used at phase entry points
 * ("Before income: where does it land?") and at the welcome intro.
 */
export function InfoCard({ card }: { card: InfoCardModel }) {
  const t = useT()
  const title = readI18n(t, card.titleKey)
  const body = card.bodyKey ? readI18n(t, card.bodyKey) : null

  return (
    <div className="space-y-3 text-center sm:text-start">
      <h2 className="text-2xl font-semibold text-[var(--color-brand-text-primary)]">
        {title}
      </h2>
      {body ? (
        <p className="text-sm leading-relaxed text-[var(--color-brand-text-secondary)]">
          {body}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Tiny helper: resolve a dotted i18n key against the Dictionary. Kept
 * here (not in the i18n lib) because only the Journey cards refer to
 * strings by dotted keys; the rest of the app uses typed accessors.
 * Falls back to the key itself if any segment is missing, so a typo
 * surfaces visibly in dev rather than crashing.
 */
export function readI18n(t: Dictionary, key: string): string {
  const parts = key.split('.')
  let cursor: unknown = t
  for (const p of parts) {
    if (cursor == null || typeof cursor !== 'object') return key
    cursor = (cursor as Record<string, unknown>)[p]
  }
  return typeof cursor === 'string' ? cursor : key
}
