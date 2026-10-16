import type { SavingsAccount } from '@/lib/store/types'

export interface PocketVM {
  account: SavingsAccount
  coverAmount: number
  goalsAmount: number
  goalLabel: string
  isAuto: boolean
}
