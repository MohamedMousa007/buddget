export const APP_TITLE = 'Buddget'
export const MAIN_ID = 'main-content'

/** Tab title for a view: its heading, then the app name; just the app name when it has no heading. */
export function documentTitleFor(heading: string | null | undefined): string {
  const h = heading?.replace(/\s+/g, ' ').trim()
  return h ? `${h} · ${APP_TITLE}` : APP_TITLE
}

/** Focus follows a view change only when nothing else owns it (no open dialog, not typing). */
export function shouldMoveFocus(state: { dialogOpen: boolean; typing: boolean }): boolean {
  return !state.dialogOpen && !state.typing
}
