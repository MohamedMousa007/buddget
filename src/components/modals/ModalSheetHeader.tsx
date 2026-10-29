'use client'

import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

/**
 * Deprecated: ModalShell now always renders the drag-handle grab strip, so a
 * header-level handle would double up. Kept as a no-op to avoid touching every
 * header call site.
 */
export function ModalSheetDragHandle() {
  return null
}

export interface ModalSheetHeaderProps {
  title: string
  onClose: () => void
  /** Margin below the title row (debt sheet historically used tighter spacing). */
  titleRowClassName?: string
}

/** Legacy modal look of {@link V3SheetHeader}; callers move to the v3 look in step 2. */
export function ModalSheetHeader(props: ModalSheetHeaderProps) {
  return <V3SheetHeader variant="modal" {...props} />
}
