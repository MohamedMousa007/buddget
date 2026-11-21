import type { Currency } from '@/lib/store/types'
import type { PocketVM } from './types'

/** The currency a pick switches the amount to. A just-created pocket is not in `pockets` yet, so its own currency wins. */
export function pocketCurrency(pockets: readonly PocketVM[], id: string | null, created?: Currency): Currency | undefined {
  return created ?? pockets.find((p) => p.account.id === id)?.account.currency
}

/** The pocket Add money deposits into: the user's pick, else the preselected one, else the first. Pockets can arrive after the sheet opens. */
export function selectedPocket(pockets: readonly PocketVM[], pickedId: string | null, defaultId: string | null | undefined): PocketVM | undefined {
  return pockets.find((p) => p.account.id === pickedId) ?? pockets.find((p) => p.account.id === defaultId) ?? pockets[0]
}
