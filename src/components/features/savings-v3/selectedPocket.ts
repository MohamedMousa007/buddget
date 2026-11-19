import type { PocketVM } from './types'

/** The pocket Add money deposits into: the user's pick, else the preselected one, else the first. Pockets can arrive after the sheet opens. */
export function selectedPocket(pockets: readonly PocketVM[], pickedId: string | null, defaultId: string | null | undefined): PocketVM | undefined {
  return pockets.find((p) => p.account.id === pickedId) ?? pockets.find((p) => p.account.id === defaultId) ?? pockets[0]
}
