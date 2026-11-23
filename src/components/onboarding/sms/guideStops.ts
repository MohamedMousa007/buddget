/**
 * Walkthrough stops for the iPhone setup guides, measured on the real captures in public/guides/sms (status bar cropped).
 * x/y are the target's centre, w/h its size, tipY the tip's top, all in % of the capture; radius in px at the player's
 * width; zoom is how wide the spotlight opens before it closes in. Approved mockups: nimbalyst-local/mockups/sms-guide-*.
 * A recapture needs new numbers.
 */
export interface GuideStop {
  src: string
  x: number
  y: number
  w: number
  h: number
  radius: number
  zoom: number
  tipY: number
  /** false: no tap mark (the stop only shows the result). */
  tap?: boolean
}

/** iOS 27 captures: 828 x 1698. */
export const IOS27_ASPECT = 828 / 1698
/** iOS 16.4-26 captures: 900 x 1833 (from 1290 x 2626). */
export const IOS26_ASPECT = 1290 / 2626

export const IOS27_STOPS = {
  addShortcut: { src: '/guides/sms/ios27/01-add-shortcut.webp', x: 50, y: 93, w: 89, h: 6.2, radius: 999, zoom: 1.7, tipY: 80 },
  openShortcut: { src: '/guides/sms/ios27/02-all-shortcuts.webp', x: 26.7, y: 25.1, w: 45, h: 12.6, radius: 9, zoom: 2.6, tipY: 37 },
  arrow: { src: '/guides/sms/ios27/03-editor-collapsed.webp', x: 25.2, y: 20.2, w: 7.6, h: 3.7, radius: 999, zoom: 7, tipY: 27 },
  automationOn: { src: '/guides/sms/ios27/04-editor-expanded.webp', x: 85.1, y: 36.6, w: 16.5, h: 3.6, radius: 999, zoom: 5, tipY: 43 },
  confirmOff: { src: '/guides/sms/ios27/05-automation-on.webp', x: 50, y: 34, w: 92, h: 10.8, radius: 9, zoom: 1.9, tipY: 43, tap: false },
} satisfies Record<string, GuideStop>

export const IOS26_STOPS = {
  automationTab: { src: '/guides/sms/ios26/01-all-shortcuts.webp', x: 50.0, y: 93.4, w: 16.7, h: 5.3, radius: 999, zoom: 6, tipY: 82.4 },
  newAutomation: { src: '/guides/sms/ios26/02-new-automation.webp', x: 50.0, y: 59.0, w: 40.0, h: 5.3, radius: 999, zoom: 3, tipY: 68.0 },
  pickMessage: { src: '/guides/sms/ios26/03-pick-message.webp', x: 50.0, y: 68.8, w: 90.8, h: 7.0, radius: 10, zoom: 2, tipY: 77.8 },
  messageContains: { src: '/guides/sms/ios26/04-when.webp', x: 50.0, y: 26.7, w: 90.8, h: 6.5, radius: 10, zoom: 2, tipY: 35.7 },
  typeSpace: { src: '/guides/sms/ios26/05-message-contains.webp', x: 50.0, y: 35.3, w: 55.0, h: 4.1, radius: 6, zoom: 3.5, tipY: 44.3 },
  runImmediately: { src: '/guides/sms/ios26/06-run-immediately.webp', x: 50.0, y: 41.4, w: 90.8, h: 5.3, radius: 10, zoom: 2, tipY: 50.4 },
  next: { src: '/guides/sms/ios26/06-run-immediately.webp', x: 90.8, y: 4.6, w: 14.2, h: 4.1, radius: 999, zoom: 6, tipY: 13.6 },
  search: { src: '/guides/sms/ios26/07-new-blank.webp', x: 50.0, y: 20.7, w: 92.5, h: 3.7, radius: 999, zoom: 2.5, tipY: 29.7 },
  pickCatch: { src: '/guides/sms/ios26/08-search-catch.webp', x: 50.0, y: 37.3, w: 92.5, h: 5.7, radius: 10, zoom: 2, tipY: 46.3 },
  bankMessage: { src: '/guides/sms/ios26/09-action-added.webp', x: 45.8, y: 30.8, w: 33.3, h: 3.7, radius: 6, zoom: 4, tipY: 39.8 },
  selectVariable: { src: '/guides/sms/ios26/10-select-variable.webp', x: 17.5, y: 57.8, w: 30.8, h: 3.7, radius: 6, zoom: 4, tipY: 66.8 },
  shortcutInput: { src: '/guides/sms/ios26/11-magic-message.webp', x: 52.1, y: 32.2, w: 40.0, h: 3.7, radius: 999, zoom: 3.5, tipY: 41.2 },
  sender: { src: '/guides/sms/ios26/12-sender-field.webp', x: 16.2, y: 33.2, w: 18.3, h: 3.7, radius: 6, zoom: 5, tipY: 42.2 },
  senderInput: { src: '/guides/sms/ios26/13-magic-sender.webp', x: 52.1, y: 32.2, w: 40.0, h: 3.7, radius: 999, zoom: 3.5, tipY: 41.2 },
  pickSender: { src: '/guides/sms/ios26/14-pick-sender.webp', x: 50.0, y: 83.6, w: 90.8, h: 4.9, radius: 8, zoom: 2.2, tipY: 62 },
  done: { src: '/guides/sms/ios26/15-done.webp', x: 90.4, y: 4.6, w: 14.2, h: 4.1, radius: 999, zoom: 6, tipY: 13.6 },
} satisfies Record<string, GuideStop>

export type Ios27StopId = keyof typeof IOS27_STOPS
export type Ios26StopId = keyof typeof IOS26_STOPS

/** The iOS 27 walkthrough, in order. */
export const IOS27_WALKTHROUGH: Ios27StopId[] = ['addShortcut', 'openShortcut', 'arrow', 'automationOn', 'confirmOff']

/** The iOS 16.4-26 guide: five steps, each a short walkthrough. */
export const IOS26_STEPS: Ios26StopId[][] = [
  ['automationTab', 'newAutomation', 'pickMessage'],
  ['messageContains', 'typeSpace', 'runImmediately', 'next'],
  ['search', 'pickCatch'],
  ['bankMessage', 'selectVariable', 'shortcutInput'],
  ['sender', 'senderInput', 'pickSender', 'done'],
]
