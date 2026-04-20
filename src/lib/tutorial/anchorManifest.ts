/**
 * The tutorial anchor manifest — the single source of truth for every
 * `data-tutorial-id` string used in the app.
 *
 * Why this exists
 * ---------------
 * Tours reference app UI by anchor id. Without a manifest, a dev could
 * rename a button and silently break a tutorial step. Two CI-enforced
 * unit tests in `__tests__/anchorManifest.test.ts` keep the manifest and
 * the codebase in sync:
 *
 *   1. Every literal `data-tutorial-id="..."` in src/ must have an entry
 *      here (or match an allow-listed dynamic pattern below).
 *   2. Every entry here must be referenced somewhere in src/ — dead
 *      entries are flagged so they don't rot silently.
 *
 * Adding a new anchor
 * -------------------
 *   - Pick a stable id (`{surface}:{field}` convention). Add a
 *     `data-tutorial-id={newId}` attribute in the JSX.
 *   - Add an entry to `ANCHORS` below with a tour membership + i18n copy
 *     key. If the anchor isn't part of any tour but still needs a spotlight
 *     target (e.g. a doc-only marker), set `tour: null`.
 *   - Run `npm run test` to confirm the sync tests pass.
 *
 * Versioning a tour
 * -----------------
 * When a tour's content changes meaningfully (new must-teach step, copy
 * overhaul), bump its version in `TOUR_VERSIONS` below. Users with the
 * previous version in `tutorials_completed` are auto-re-entered into the
 * bumped tour on next app open.
 */

/** The app's known tour ids. Add new tours here + bump version when their
 *  content changes. */
export const TOUR_VERSIONS = {
  debugSmoke: 1,
  postOnboardingTour: 1,
  addIncomeTour: 1,
  addPmTour: 1,
  addDebtTour: 1,
  addSavingsTour: 1,
  addSubscriptionTour: 1,
  addGoalTour: 1,
} as const

export type TourId = keyof typeof TOUR_VERSIONS

export interface AnchorEntry {
  /** Tour this anchor belongs to. `null` = the anchor exists for other
   *  reasons (analytics, testing) and isn't part of any tour. */
  tour: TourId | null
  /** Order within the tour. Steps render in ascending order. Gaps are fine. */
  order?: number
  /** i18n key for the step body; title key is `<copyKey>.title`, body is
   *  `<copyKey>.body`. */
  copyKey?: string
  /** When true, the step lets clicks pass through to the target element
   *  (e.g. a "Tap Tune" step). The tour pauses and resumes when the user
   *  interacts. Default false. */
  interactive?: boolean
  /** When the target is on a specific route, set this so the controller
   *  can navigate before spotlighting. Default: current route. */
  route?: string
  /** Popover placement hint — `auto` lets the overlay decide based on
   *  available space. */
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
  /** Separate anchor for desktop-only + mobile-only variants of the same
   *  conceptual step. When both are defined, the controller picks based
   *  on viewport. */
  viewport?: 'desktop' | 'mobile'
}

/**
 * The manifest. Every `data-tutorial-id="..."` literal in src/ MUST appear
 * here. Dynamic patterns (see `ALLOWED_DYNAMIC_PATTERNS`) are allow-listed
 * separately.
 */
export const ANCHORS: Record<string, AnchorEntry> = {
  // ── Debug / smoke tour (dev-only; proves the engine works) ─────────
  'debug:fab': {
    tour: 'debugSmoke',
    order: 1,
    copyKey: 'tour.debug.fab',
  },
  'debug:checklist': {
    tour: 'debugSmoke',
    order: 2,
    copyKey: 'tour.debug.checklist',
  },
  'debug:nav-home': {
    tour: 'debugSmoke',
    order: 3,
    copyKey: 'tour.debug.navHome',
  },

  // ── Pre-existing app anchors ─────────────────────────────────────
  'checklist-root': { tour: null },
  'build-budget-cta': { tour: null },
  'profile-menu-trigger': { tour: null },
  // Reused by the post-onboarding tour as the "Quick add" step. The
  // anchor element (BottomNav FAB button) lives on every authed route
  // that renders bottom-nav; the tour step pins it to the dashboard.
  'fab-root': {
    tour: 'postOnboardingTour',
    order: 5,
    copyKey: 'tour.postOnboard.fab',
    route: '/',
    placement: 'top',
  },

  // ── Post-onboarding guided tour (SP6) ────────────────────────────
  // Fires automatically when the user lands on /budget-setup?tour=1
  // right after finishing the Journey; re-runnable from Settings →
  // "Show me around".
  'postOnboard:plan-root': {
    tour: 'postOnboardingTour',
    order: 1,
    copyKey: 'tour.postOnboard.planRoot',
    route: '/budget-setup',
    placement: 'bottom',
  },
  'postOnboard:category-row': {
    tour: 'postOnboardingTour',
    order: 2,
    copyKey: 'tour.postOnboard.categoryRow',
    route: '/budget-setup',
    placement: 'bottom',
  },
  'postOnboard:rebuild-cta': {
    tour: 'postOnboardingTour',
    order: 3,
    copyKey: 'tour.postOnboard.rebuild',
    route: '/budget-setup',
    placement: 'top',
  },
  'postOnboard:dashboard-main': {
    tour: 'postOnboardingTour',
    order: 4,
    copyKey: 'tour.postOnboard.dashboard',
    route: '/',
    placement: 'bottom',
  },
  'postOnboard:savings-root': {
    tour: 'postOnboardingTour',
    order: 6,
    copyKey: 'tour.postOnboard.savings',
    route: '/savings',
    placement: 'bottom',
  },
  'postOnboard:expenses-filter': {
    tour: 'postOnboardingTour',
    order: 7,
    copyKey: 'tour.postOnboard.expenses',
    route: '/expenses',
    placement: 'bottom',
  },
  'postOnboard:profile-root': {
    tour: 'postOnboardingTour',
    order: 8,
    copyKey: 'tour.postOnboard.profile',
    route: '/profile',
    placement: 'bottom',
  },

  // ── AddPaymentMethod modal tour (SP2) ─────────────────────────────
  'pm-modal:name': {
    tour: 'addPmTour',
    order: 1,
    copyKey: 'tour.modal.pm.name',
    placement: 'bottom',
  },
  'pm-modal:type': {
    tour: 'addPmTour',
    order: 2,
    copyKey: 'tour.modal.pm.type',
    placement: 'bottom',
  },
  'pm-modal:currency': {
    tour: 'addPmTour',
    order: 3,
    copyKey: 'tour.modal.pm.currency',
    placement: 'bottom',
  },
  'pm-modal:save': {
    tour: 'addPmTour',
    order: 4,
    copyKey: 'tour.modal.pm.save',
    placement: 'top',
    interactive: true,
  },

  // ── AddDebt modal tour (SP8) ──────────────────────────────────────
  'debt-modal:type': {
    tour: 'addDebtTour',
    order: 1,
    copyKey: 'tour.modal.debt.type',
    placement: 'bottom',
  },
  'debt-modal:balance': {
    tour: 'addDebtTour',
    order: 2,
    copyKey: 'tour.modal.debt.balance',
    placement: 'bottom',
  },
  'debt-modal:save': {
    tour: 'addDebtTour',
    order: 3,
    copyKey: 'tour.modal.debt.save',
    placement: 'top',
    interactive: true,
  },

  // ── AddSavingsAccount modal tour (SP8) ────────────────────────────
  'savings-modal:name': {
    tour: 'addSavingsTour',
    order: 1,
    copyKey: 'tour.modal.savings.name',
    placement: 'bottom',
  },
  'savings-modal:balance': {
    tour: 'addSavingsTour',
    order: 2,
    copyKey: 'tour.modal.savings.balance',
    placement: 'bottom',
  },
  'savings-modal:save': {
    tour: 'addSavingsTour',
    order: 3,
    copyKey: 'tour.modal.savings.save',
    placement: 'top',
    interactive: true,
  },

  // ── AddSubscription modal tour (SP8) ──────────────────────────────
  'subscription-modal:amount': {
    tour: 'addSubscriptionTour',
    order: 1,
    copyKey: 'tour.modal.subscription.amount',
    placement: 'bottom',
  },
  'subscription-modal:cycle': {
    tour: 'addSubscriptionTour',
    order: 2,
    copyKey: 'tour.modal.subscription.cycle',
    placement: 'bottom',
  },
  'subscription-modal:save': {
    tour: 'addSubscriptionTour',
    order: 3,
    copyKey: 'tour.modal.subscription.save',
    placement: 'top',
    interactive: true,
  },

  // ── AddGoal modal tour (SP8) ──────────────────────────────────────
  'goal-modal:name': {
    tour: 'addGoalTour',
    order: 1,
    copyKey: 'tour.modal.goal.name',
    placement: 'bottom',
  },
  'goal-modal:save': {
    tour: 'addGoalTour',
    order: 2,
    copyKey: 'tour.modal.goal.save',
    placement: 'top',
    interactive: true,
  },

  // ── AddIncome modal tour (SP2) ────────────────────────────────────
  'income-modal:name': {
    tour: 'addIncomeTour',
    order: 1,
    copyKey: 'tour.modal.income.name',
    placement: 'bottom',
  },
  'income-modal:payment-method': {
    tour: 'addIncomeTour',
    order: 2,
    copyKey: 'tour.modal.income.paymentMethod',
    placement: 'bottom',
  },
  'income-modal:amount': {
    tour: 'addIncomeTour',
    order: 3,
    copyKey: 'tour.modal.income.amount',
    placement: 'top',
  },
  'income-modal:save': {
    tour: 'addIncomeTour',
    order: 4,
    copyKey: 'tour.modal.income.save',
    placement: 'top',
    interactive: true,
  },
}

/**
 * Template-interpolated anchor ids can't appear as literal keys in
 * `ANCHORS`. Declare the **static prefix** of each template here so the
 * CI sync test knows to accept them. Example: `nav-${item.label}` has
 * prefix `'nav-'`. The runtime regex validates the full concrete value.
 */
export interface DynamicAnchorPattern {
  /** Leading static portion of the template literal. */
  prefix: string
  /** Regex the full concrete value must match at runtime. */
  match: RegExp
  /** Optional: tour membership. When set, every concrete value that
   *  matches becomes part of this tour. */
  tour?: TourId | null
}

export const DYNAMIC_ANCHOR_PATTERNS: DynamicAnchorPattern[] = [
  // Bottom-nav items: produces nav-Home, nav-Expenses, nav-Debts, nav-More.
  { prefix: 'nav-', match: /^nav-[A-Z][a-zA-Z\s]+$/, tour: null },
  // First-run checklist rows: produces checklist-row-income, etc.
  { prefix: 'checklist-row-', match: /^checklist-row-[a-z0-9_-]+$/, tour: null },
]

/** Combine a tour id with its current version into a single storage key.
 *  Used by `tutorials_completed[]` so a version bump auto-invalidates the
 *  old completion marker. */
export function tourStorageKey(tourId: TourId): string {
  return `${tourId}:v${TOUR_VERSIONS[tourId]}`
}
