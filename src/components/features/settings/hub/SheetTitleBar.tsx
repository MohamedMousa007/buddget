'use client'

import type { ReactNode } from 'react'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

/** The title row of a settings sheet: the `bar` look of {@link V3SheetHeader}. */
export function SheetTitleBar(props: { title: string; onClose: () => void; leading?: ReactNode }) {
  return <V3SheetHeader variant="bar" {...props} />
}
