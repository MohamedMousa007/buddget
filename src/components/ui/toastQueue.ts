export interface ToastItem {
  id: number
  message: string
  undo?: () => void
  undoLabel?: string
}

export const MAX_TOASTS = 3
export const TOAST_MS = 3000
export const TOAST_UNDO_MS = 8000

export function toastDuration(hasUndo: boolean): number {
  return hasUndo ? TOAST_UNDO_MS : TOAST_MS
}

/** Appends a toast, dropping the oldest plain toast first (never one that still carries an Undo) once over the cap. */
export function pushToast(list: ToastItem[], item: ToastItem): ToastItem[] {
  const next = [...list, item]
  while (next.length > MAX_TOASTS) {
    const drop = next.findIndex((x) => !x.undo)
    next.splice(drop === -1 ? 0 : drop, 1)
  }
  return next
}
