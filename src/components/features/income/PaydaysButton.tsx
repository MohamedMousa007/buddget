'use client'

import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { useT } from '@/lib/i18n'

/**
 * Paydays in Flow's sub-header: icon + label, or the same 44px control icon-only
 * (`aria-label="Paydays"`) when the row can't fit the label. The row decides (see
 * FlowSubHeader); this only draws the two forms.
 */
export function PaydaysButton({ onClick, iconOnly }: { onClick: () => void; iconOnly: boolean }) {
  const t = useT()
  return iconOnly ? (
    <IconButton variant="outlined" size="md" aria-label={t.nav.paydays} onClick={onClick}>
      <CalendarClock className="size-[19px]" strokeWidth={1.75} />
    </IconButton>
  ) : (
    <Button variant="outline" size="touch" onClick={onClick}>
      <CalendarClock className="size-4" strokeWidth={1.75} />
      {t.nav.paydays}
    </Button>
  )
}
