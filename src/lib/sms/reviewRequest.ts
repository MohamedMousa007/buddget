/**
 * A push tap asks the review sheet to open. The sheet's owner (HeldMessagesHost) may not be mounted yet when the
 * tap replays, so an unanswered request is remembered and delivered on subscribe.
 */
let listener: (() => void) | null = null
let waiting = false

export function requestSmsReview(): void {
  if (listener) listener()
  else waiting = true
}

export function subscribeSmsReviewRequests(next: () => void): () => void {
  listener = next
  if (waiting) {
    waiting = false
    next()
  }
  return () => { if (listener === next) listener = null }
}

export function __resetSmsReviewRequests(): void {
  listener = null
  waiting = false
}
