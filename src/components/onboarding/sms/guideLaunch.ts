/** Where the iPhone setup guide opens next: its branded screen, or straight at the walkthrough (iOS 27 "Add shortcut"). */
export type GuideStart = 'intro' | 'walkthrough'

let next: GuideStart = 'intro'

/** Set just before navigating to /settings/sms. */
export function setGuideStart(start: GuideStart): void {
  next = start
}

/** Read by the guide page (pure, so a double render reads the same value); it resets with `setGuideStart('intro')` on close. */
export function readGuideStart(): GuideStart {
  return next
}
