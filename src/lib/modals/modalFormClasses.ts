/** Shared add-* sheet field styling (see product modal polish spec). */
export const MODAL_LABEL_CLASS =
  'block text-xs font-normal uppercase tracking-wider text-[var(--color-brand-text-secondary)]'

/**
 * Neutral focus ring for NON-shadcn controls (plain buttons/inputs/pills) that
 * previously hardcoded a red focus. shadcn Input/Textarea already ring via the
 * (now-neutral) `--ring` token, so don't add this on top of them. Red is reserved
 * for error/invalid states. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55'

/**
 * Primary text / number inputs inside modals. Focus is left to the underlying
 * shadcn Input (neutral `--ring`); this class only kills the native outline so
 * there's no double ring. */
export const MODAL_CONTROL_CLASS =
  'w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3 h-12 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus-visible:outline-none disabled:opacity-50'

export const MODAL_BODY_SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-5'

export const MODAL_SHEET_OUTER_CLASS = 'flex max-h-[90vh] flex-col outline-none'
