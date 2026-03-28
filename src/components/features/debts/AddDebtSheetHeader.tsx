'use client'

import { ModalSheetHeader, type ModalSheetHeaderProps } from '@/components/modals/ModalSheetHeader'

export type AddDebtSheetHeaderProps = ModalSheetHeaderProps

/** Drag handle + title + close for debt modal (tighter spacing below title). */
export function AddDebtSheetHeader({ title, onClose }: AddDebtSheetHeaderProps) {
  return <ModalSheetHeader title={title} onClose={onClose} titleRowClassName="mb-4" />
}
