'use client'

import { X } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { CurrencyList } from '@/components/ui/CurrencyList'
import { IconButton } from '@/components/ui/IconButton'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useLocale } from '@/lib/i18n'
import type { Currency } from '@/lib/store/types'

interface CurrencySheetProps {
  open: boolean
  /** Currently selected ISO code. */
  value: string
  /** Fired on row tap; the caller sets state and closes. */
  onSelect: (code: string) => void
  onClose: () => void
  /** User's base currency, pinned first under Common. */
  base?: Currency
  /** Include gold (XAU), for debt currency pickers. */
  includeGold?: boolean
  /** Restrict the list to these codes (defaults to all fiat, +XAU when includeGold). */
  codes?: readonly string[]
  zIndexClassName?: string
}

/** The app's currency picker: pinned common currencies, search, A to Z. Used for every single-currency choice. */
export function CurrencySheet({ open, value, onSelect, onClose, base, includeGold, codes, zIndexClassName }: CurrencySheetProps) {
  const { locale } = useLocale()
  useEscapeClose(open, onClose)
  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName={zIndexClassName ?? 'z-[110]'} panelClassName="md:w-[440px]" padContent>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{locale === 'ar' ? 'العملة' : 'Currency'}</h2>
          <IconButton onClick={onClose} aria-label={locale === 'ar' ? 'إغلاق' : 'Close'} variant="tinted" size="sm" shape="round">
            <X className="h-full w-full" />
          </IconButton>
        </div>
        <CurrencyList value={value} onSelect={onSelect} base={base} includeGold={includeGold} codes={codes} />
      </div>
    </ModalShell>
  )
}
