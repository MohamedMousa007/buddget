import s from './cosmetics.module.css'

/** Card finishes with art: `aurora` (points shop) and `connector` (ten invited friends). Anything else draws the standard card. */
const FINISH: Record<string, string | undefined> = { aurora: s.aurora, connector: s.connector }

/** The class a card's flip rig takes for the member's chosen finish; undefined for the standard one. */
export const cardFinishClass = (finish: string | null | undefined): string | undefined => (finish ? FINISH[finish] : undefined)

/** The attribute the Buddgy look is published under on <html>, for the Buddgy face to style against. */
export const BUDDGY_LOOK_ATTR = 'data-buddgy-look'
