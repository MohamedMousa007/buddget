export const APP_TITLE = 'buddget'
export const MAIN_ID = 'main-content'
/** A view names itself with its h1, or with `data-route-title` on a sub-view heading that is an h2 under the shell's h1. */
export const ROUTE_TITLE_SELECTOR = '[data-route-title], h1'

/** Tab title for a view: its heading, then the app name; just the app name when it has no heading. */
export function documentTitleFor(heading: string | null | undefined): string {
  const h = heading?.replace(/\s+/g, ' ').trim()
  return h ? `${h} · ${APP_TITLE}` : APP_TITLE
}

/**
 * The view's name: a heading inside `<main>` when it has its own (sub-pages stay specific), else the shell header's section title,
 * which sits outside `<main>` on the main tabs.
 */
export function headingFor(mainHeading: string | null | undefined, sectionTitle: string | null | undefined): string | null {
  return mainHeading?.trim() || sectionTitle?.trim() || null
}

/** Focus follows a view change only when nothing else owns it (no open dialog, not typing). */
export function shouldMoveFocus(state: { dialogOpen: boolean; typing: boolean }): boolean {
  return !state.dialogOpen && !state.typing
}
