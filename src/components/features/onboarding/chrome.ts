/** What every step receives from the journey: where it sits and how to move. */
export interface StepChrome {
  index: number
  total: number
  onBack?: () => void
  onSkip: () => void
  /** Saves progress and moves to the next visible step. */
  next: () => void
}
