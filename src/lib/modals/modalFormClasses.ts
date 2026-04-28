/** Shared add-* sheet field styling (see product modal polish spec). */
export const MODAL_LABEL_CLASS =
  'block text-xs font-normal uppercase tracking-wider text-[#5A5A72]'

/** Primary text / number inputs inside modals. */
export const MODAL_CONTROL_CLASS =
  'w-full rounded-xl border border-[#2A2A38] bg-[#1A1A24] px-4 py-3 h-12 text-sm text-white placeholder:text-[#5A5A72] focus-visible:outline-none focus-visible:ring-0 focus:border-[#E50914] disabled:opacity-50'

/** Prominent amount entry. */
export const MODAL_AMOUNT_CLASS = `${MODAL_CONTROL_CLASS} text-2xl font-semibold font-mono-numbers`

export const MODAL_BODY_SCROLL_CLASS = 'min-h-0 flex-1 overflow-y-auto flex flex-col gap-5'

export const MODAL_SHEET_OUTER_CLASS = 'flex max-h-[90vh] flex-col outline-none'
