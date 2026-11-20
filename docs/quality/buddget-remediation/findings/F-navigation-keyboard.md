# Findings F: iOS navigation, keyboard, floating Buddgy (BDG-014, BDG-017, BDG-018)

Read-only. Worktree at origin/main (3d65b36f over 9fb37fd1). Unmerged branches touching these paths: none found (`git branch -r --no-merged` lists only auth-hardening, ecstatic-shamir, elastic-poitras, epic-cannon, s2-pocket, s8a-qa-fix, dependabot, fix/push-allow-hang; none are navigation/chat related by name; not diffed). All three symptoms exist at origin/main.

## Shared facts (confirmed)
- No `@capacitor/keyboard` plugin: absent from `package.json:30-46`, and `capacitor.config.ts:27-76` has no `Keyboard` block. So on iOS there is NO native resize policy at all. `resize: native|body|ionic|none` (iOS-only, default native) does not apply because the plugin is not installed. Source: https://capacitorjs.com/docs/apis/keyboard (resize modes described there).
- iOS: `contentInset: 'never'` (`capacitor.config.ts:36-41`); `BuddgetViewController.swift:26-44` sets bounces off, zoom off; nothing about keyboard or back gestures.
- Android: `AndroidManifest.xml:21` `windowSoftInputMode="adjustResize"`, so the WebView itself shrinks (`window.innerHeight` drops). On iOS WKWebView does not shrink; the visual viewport shrinks/pans instead. `ModalShell.tsx:92-100` already documents this split.
- The whole app scrolls on the window/body (`AppShell.tsx:335`), not an inner scroller.

---

## BDG-014 Keyboard pushes the Buddgy chat far up

| Field | Content |
|---|---|
| Issue ID | BDG-014 |
| Summary | The chat panel is `position: fixed` with a `top`/`height` computed once in pixels from `window.innerHeight` and no keyboard awareness, so the OS keyboard pans or resizes the viewport underneath it. |
| Severity | P1 (core AI surface, every typed message on a phone) |
| Reproducibility | Consistent on iOS by design of the code path (hypothesis on exact pixel jump: needs device). Steps: open Buddgy orb, tap composer. Android: panel mostly adapts, but see Android defect below. |
| Platform | iOS (main), Android (secondary defects), web mobile Safari (same as iOS) |
| Affected components | `src/components/features/ai-chat/AIChat.tsx:50-75` (computePanel), `:92-99` (recompute on `resize` only), `:121-135` (fixed panel with `style.top/height`), `AIChatComposer.tsx:25-27` (composer is last flex child, no safe-area/keyboard handling), `src/lib/ui/scrollLock.ts:17-28`, `src/components/ai/AIChatBubble.tsx:27,86-95` |
| Backend dependencies | none |
| Root cause | See below. |
| Confidence | high for "no keyboard handling in the chat"; medium for exact iOS visual jump size |
| Missing evidence | Device recording on iOS 146 build; whether WebKit pans by exactly keyboard height here. |

### Mechanism (confirmed code, iOS effect = hypothesis from WebKit behaviour)
1. `computePanel` (`AIChat.tsx:56-77`) reads `window.innerHeight` (layout viewport, which iOS does NOT shrink for the keyboard with no Keyboard plugin) and makes the panel `fixed`, `top = clamp(orbCenter - h/2)`, `height = min(0.82*vh, 600, availH)`. It has a `resize` listener only (`:92-99`). iOS fires no window `resize` for the keyboard (visualViewport does).
2. Panel bottom is `top+height`, up to `vh - safeBottom - 76` (NAV_CLEAR `:26`). A ~300pt iOS keyboard covers the composer, which is the last child (`AIChatComposer.tsx:25`).
3. WKWebView therefore scrolls/pans the visual viewport upward to reveal the focused textarea. A `position: fixed` element is attached to the layout viewport, so the whole panel (header included) slides up and its top goes off-screen: "pushed far up, layout broken". `useScrollLock` (`body overflow hidden`, `scrollLock.ts:21`) does not stop WebKit's own focus-reveal pan.
4. Other sheets do not have this because `ModalShell` is bottom-anchored (`bottom-0`) and listens to `visualViewport` resize/scroll and pads the bottom (`ModalShell.tsx:208-259`, `style paddingBottom` at the panel). The chat is the only large top-anchored fixed panel with an input. `NumberPad` and `LandingGate.tsx:49-60`, `AuthSignInUpStep.tsx:90` also use `visualViewport`.

### Android defects (confirmed)
- `adjustResize` shrinks `innerHeight`, `computePanel` reruns, panel shrinks to `availH`; mostly works. But the panel still reserves `NAV_CLEAR` 76 and `ins.bottom` while the keyboard is up, wasting height, and the 0.82 vh ratio recomputes every frame of the keyboard animation (state churn).
- Real bug: `AIChatBubble.tsx:86-95` runs `fit()` on every `resize`, and `clampTop` is `min(innerHeight - 150, top)` (`:27`). On Android the keyboard shrinks `innerHeight`, so `fit()` calls `setBuddgyOrb` and permanently lowers the persisted `buddgyOrb.top` (`useSettingsStore.ts:385` persists it). After one keyboard open the orb has moved up and stays there. Relevant to BDG-018 too.

### Proposed solution (smallest, follows safe-area model)
Mirror `ModalShell`, no plugin, no `resize` config change, no overflow lock:
1. In `AIChat.tsx`, replace the `window.innerHeight` source in `computePanel` with the visual viewport: `const vv = window.visualViewport; vh = vv?.height ?? innerHeight; offsetTop = vv?.offsetTop ?? 0`, add `offsetTop` to `top`, and recompute on `vv` `resize` and `scroll` (same listeners as `ModalShell.tsx:223-224`). Keep `env()` insets via `--sai-*`.
2. Detect keyboard open as `innerHeight - vv.height - vv.offsetTop > 120` (as `LandingGate.tsx:52`) and then use `bottomClear = EDGE_GAP`, `ins.bottom = 0`, and anchor the panel so `top+height <= vv.offsetTop + vv.height`. Panel is then fully above the keyboard on iOS and Android; composer stays visible.
3. In `AIChatBubble.tsx` `fit()`, skip persisting while the keyboard is up (compare to `vv`), or clamp on read instead of write.
4. Do NOT install `@capacitor/keyboard` just for this: `resize: 'native'` would shrink the WebView on iOS and make the existing `visualViewport` math in ModalShell, LandingGate etc. report no inset (the "double offset" risk), changing every sheet. If the owner later wants one native policy, `resize: 'none'` plus the visualViewport handlers is the combination consistent with `contentInset: 'never'`.
Reuse: the `ModalShell` visualViewport effect could be extracted into a shared `useKeyboardInset()` hook (ModalShell, LandingGate, AuthSignInUpStep, AIChat all hand-roll it). Extraction is optional and a larger change; the minimum is to copy the pattern into AIChat.

| Regression risk | Panel anchored to orb geometry (`originX/Y`, spring grow animation) must not re-animate on each vv event: set only `top/height`, not `key`. Desktop (>=1024) unaffected if the keyboard test is gated on `pointer: coarse`. RTL unaffected (side props unchanged). |
| Test that proves it | Unit test of a pure `computePanel(orb, viewport)` (extract the function): with `vv.height = innerHeight - 300` and offsetTop 0, assert `top + height <= vv.height - gap`. Playwright with emulated mobile cannot raise a real keyboard; confirm on device (owner review). |
| Shared causes | BDG-018 (orb position corrupted by `resize`), generic sheet keyboard handling (ModalShell). |

---

## BDG-017 Edge-swipe back / no back button on some pages

| Field | Content |
|---|---|
| Issue ID | BDG-017 |
| Summary | Navigation is History API pushState driven in memory, and a number of reachable screens render no back control; iOS has no back gesture at all. |
| Severity | P1 |
| Reproducibility | Consistent. Open profile menu, then Goals / Reports / Subscriptions / Notifications / Budget plan on iOS: no back button, no gesture, only a tab tap or wordmark. |
| Platform | iOS (Android has hardware back at `AppShell.tsx:254-278`; web has browser back) |
| Affected components | `src/lib/navigation/navigate.ts:27-42`, `navStore.ts:43-65`, `AppShell.tsx:248-281`, `DesktopHeaderBar.tsx:36-58`, page list below |
| Backend dependencies | none |
| Confidence | high |
| Missing evidence | On-device behaviour of WKWebView native gesture with pushState (not testable here). |

### How back works today (confirmed)
- `navigate()` does `history.pushState` then `setNavPath` for the 36 shell paths (`shellRoutes.ts:9-44`), plus `/admin` native; everything else is a full document load (`navigate.ts:27-42`). `replace` is supported. `bindPopState` (`navStore.ts:60-65`, bound at `AppShell.tsx:313`) maps `popstate` to the view, so `history.back()` already works as an in-memory back that preserves nothing but the previous view (scroll is reset: `navigate()` calls `window.scrollTo(0,0)`, `:36`; on pop there is no scroll restoration code found).
- Every tab tap, profile-menu link and `AppLink` pushes an entry, so the history is a full trail including sibling-tab hops; "back" from `/accounts` after Flow -> Accounts returns to Flow.
- Android only: `backButton` listener (`AppShell.tsx:254-278`): `runBackGuards()` (LIFO registry, `backGuard.ts:11-24`) -> close active modal -> if `pathnameRef !== '/'`: `history.back()` if `canGoBack` else `navigate('/')` -> double-press-to-exit toast on `/`. Overlays register via `ModalShell` and `useDismissable` (`useDismissable.ts`), `PaydaysPage.tsx:107-110` registers a guard commented "Hardware / gesture back". Note `pathnameRef` comes from Next `usePathname` while the view is driven by `useNavPath` (`navStore.ts:8-14` comment admits the two can differ); inconsistency risk, not verified as a bug.
- iOS: no listener, no `allowsBackForwardNavigationGestures` (grep of `ios/App/App` finds none); `BuddgetViewController.swift` sets none.

### Screens: back affordance audit (confirmed by grep)
Have a back control: `/settings/*` sub-pages via `SettingsSubPageShell.tsx:52` (`backHref` default `/settings`), `/paydays` (own header, `ownsHeader.ts:6`), `/budget-history` (`PlanHistoryPage.tsx:92`), `/start` (JourneyFrame / StudioPage back `StudioPage.tsx:267`), onboarding steps, many sheets (ModalShell).
No back control (mobile header is wordmark + section title only, `DesktopHeaderBar.tsx:40-56`, no chevron): `/goals`, `/reports`, `/subscriptions`, `/notifications`, `/budget-setup` (inner segment has `onBack`, the page itself does not), plus `/settings` itself (hub; reached from profile menu), `/wealth`, `/accounts`, `/debts`, `/flow` (these four/five are bottom-nav tabs, so no back is expected). The first five plus `/settings` are the true dead ends: they are reached from the profile menu/tiles/cards (`ProfileDropdown.tsx:108,147`) and are not tabs, so the only exits are the wordmark link or a tab.

### iOS options
1. **WKWebView `allowsBackForwardNavigationGestures = true`** (set in `BuddgetViewController.viewDidLoad`, 1 line Swift; or community plugin `capacitor-swipe-back`). Apple documents the property as a horizontal swipe navigating the web view's back-forward list (https://developer.apple.com/documentation/webkit/wkwebview/allowsbackforwardnavigationgestures; the page body did not load in my fetch, so this restates the property name only). WebKit's gesture is built on the back-forward list and snapshots pages; same-document pushState entries are part of the list, but WebKit bug https://bugs.webkit.org/show_bug.cgi?id=149015 records maintainers saying pushState-driven transitions will not get a proper animated gesture, and Apple forum https://developer.apple.com/forums/thread/766975 reports the swipe jumping to the first page on iOS 17.5+. Expected result here: the swipe fires `popstate` (our store handles it) but with a blank/stale page snapshot in the transition and no way to run `runBackGuards()` first, so open sheets would be bypassed. It also has no knowledge of the shell's no-history case (swipe on the first entry does nothing, which is fine) and it fights horizontal scrollers only at the exact screen edge (system-owned). Cost: 1 line, zero build size. Risk: guards bypassed, snapshot glitches. Needs device test.
2. **Native UIScreenEdgePanGestureRecognizer in the Capacitor shell** calling JS (`evaluateJavaScript("window.__back()")` or a plugin event). Edge-only (left edge, so no clash with carousels that start inside the screen, as the OS back swipe), can call the same JS handler as Android (`runBackGuards` -> modal -> `history.back()`), so overlays and no-history are handled the same as Android. Needs a small Swift change in `BuddgetViewController.swift` (about 25 lines) plus a JS bridge function; native build required; no dependency. RTL: edge flips (`view.semanticContentAttribute`), must be handled explicitly. Conflict: iOS system back gesture is not active in a bare WKWebView, so no OS clash; the gesture must `require(toFail:)` nothing.
3. **JS edge-swipe** (touch within 16-20pt of the left edge, horizontal dominant, threshold ~60pt then `history.back()` through the same handler). The only existing page-level touch handler is `PullToRefresh.tsx:45-135` (window touchstart/move/end with axis lock and `[data-no-ptr]` opt-out); the "one gesture hook only" rule in memory refers to `useVoiceHoldGesture` for FABs (`project_fab_ghost_click`) and does not cover this, but a second window-level touch listener adds the same risk class, so extend PullToRefresh's axis-lock logic or share a small `useEdgeBack` that PullToRefresh also respects. No native rebuild (ships OTA with the web bundle), works on Android and web too, can call `runBackGuards()` first, can ignore touches starting in `[data-no-ptr]`, horizontal scrollers (`PaymentCardCarousel`, `PaydayTimeline`, `PlanDeck` snap) only conflict if they start within the 20pt edge zone, and WKWebView does not consume edge touches without option 1. No rubber-band animation (could add a simple translate on the page).
**Recommendation: option 3 (JS edge-swipe, left edge, RTL aware, calling the same handler as Android hardware back),** with option 1 left off. Extract Android's handler body (`AppShell.tsx:254-277`) into a shared `goBack()` first so both call one function. Trade-off versus 2: no native animation, but zero native build and identical semantics to Android. Add the exit rule: on a root route with no history do nothing (never leave the app, no exit toast on iOS).

### Is the root problem missing back buttons? (plain answer)
Yes, mostly. A gesture is a shortcut, not discoverability: the dead-end screens above have no visible control, and a gesture does not help users who never learn it, nor Android users with gesture nav off, nor web. The history trail also includes tab hops, so back from a profile-menu screen can land on an unexpected tab. Recommended minimum: add a back control (reuse the `SettingsSubPageShell` pattern: `Button variant="ghost" size="touch"` with `t.common.back`) to `/goals`, `/reports`, `/subscriptions`, `/notifications`, `/budget-setup`, and `/settings` via the shared header when the page is not a tab, plus the gesture. Decide what "back" means for non-tab screens (history.back vs a fixed parent) with the owner.

| Proposed solution | Shared `goBack()` extraction from AppShell; conditional back button in the mobile header for non-tab shell paths (`DesktopHeaderBar.tsx:48`, using a `isTabRoot(path)` helper next to `isTabActive.ts`); edge-swipe in/near `PullToRefresh.tsx`. No migration. |
| Regression risk | Edge-swipe vs sheets (must no-op when any `ModalShell`/guard is open: call `runBackGuards()` first, and skip while `isScrollLocked()`, `scrollLock.ts:44`); vs `PaydayTimeline`/`PlanDeck` carousels (start-in-edge-only); RTL mirror; popstate scroll loss (`navigate` resets scroll, pop does not restore); header height change on pages that `ownsHeader`. |
| Test that proves it | Vitest on the extracted `goBack(state)` (guard consumed, modal open, history present, root, no history). Playwright with touch emulation: swipe from x=5 on `/goals` returns to the previous path; swipe inside a carousel at x=200 does not. |
| Shared causes | Same `runBackGuards` registry for BDG-014 sheets; BDG-018 (orb near left edge default side `left`, `useSettingsStore.ts:290`, collides with an edge-swipe zone: orb has `data-no-ptr`, so edge-back must also ignore it). |

---

## BDG-018 Floating Buddgy drag shows no sign it can switch sides

| Field | Content |
|---|---|
| Issue ID | BDG-018 |
| Summary | The orb follows the finger only vertically; the side is decided by finger x vs screen midpoint and the orb teleports at the midline, so the user never sees it travelling sideways. |
| Severity | P2 |
| Reproducibility | Consistent: drag the orb horizontally; it stays glued to its edge until the finger crosses the center, then flips. |
| Platform | all |
| Affected components | `AIChatBubble.tsx:109-139` (drag), `:27` clampTop, `:86-95` fit, `:178-190` style, `useSettingsStore.ts:51,290-291,385` |
| Backend dependencies | none (persisted in local settings store, `useSettingsStore.ts:385`) |
| Confidence | high |
| Missing evidence | Whether it syncs to the server (not checked beyond the persist key). |

### Current behaviour (confirmed)
- Pointer capture on the button; on move `top = clampTop(clientY - 28)` and `side = clientX < innerWidth/2 ? 'left' : 'right'`, written straight to the store on every move (`:117-125`). Position is rendered as `top` + `left|right: EDGE_INSET (8)` (`:178-182`), so x is never applied. Result: the orb slides up/down on its edge and, when the finger passes the middle, jumps to the opposite edge in one frame. There is no horizontal tracking, no snap animation, no hint. Mood goes `happy` while dragging (`:149`), the only drag feedback.
- No edge snapping logic beyond the side flip; position stored as `{side, top}` (`useSettingsStore.ts:51`), default `{left, 620}` (`:290`), persisted.
- Avoidance: `clampTop` = `max(70, min(innerHeight - 150, top))` constants (`:27`), not safe-area aware, not keyboard aware, not tab-bar-height aware (bottom nav plus `8.5rem` page padding, `AppShell.tsx:335`); the chat panel does use safe areas and NAV_CLEAR/FAB_CLEAR (`AIChat.tsx:24-27`). The orb can sit over the tab bar's top edge on tall bars and over the desktop QuickAddFAB (right side).
- RTL: `side` is physical left/right, not start/end; stored side does not mirror when language flips. The panel and nudge use physical `left/right` too (`AIChat.tsx:125`, `AIChatBubble.tsx:215`). Acceptable (user places it), but the default `left` is the end side in RTL.
- Keyboard: none (see BDG-014 `fit()` bug). Gesture: `touchAction: 'none'`, `data-no-ptr` stops pull-to-refresh (`pullToRefreshLogic.ts:30-33`), `onTouchStart/Move stopPropagation` (`:174-175`). Accessibility: click with `detail === 0` opens (`:172`); no keyboard/switch way to move it.

### Why the affordance is missing
Position is a function of two derived values (`top`, `side`) rather than a free x; no visual cue of a drop target; no one-time hint.

### Options for the four-voice Council
A. **Side-to-side with a hint** (keep vertical drag, make it also glide horizontally between the two edges with a short spring snap and a one-time "drag me to either side" tooltip using the existing nudge bubble, `AIChatBubble.tsx:195-216`). Gesture: unchanged drag, no new conflicts. A11y: add a "Move to other side" action reachable by keyboard (e.g. long-press menu or settings toggle). Simplest, smallest change.
B. **Free drag with snap to nearest edge** (x follows the finger via motion value; on release snap to left/right edge by finger x, spring). Most discoverable; risk: orb left mid-screen if release is cancelled (`pointercancel`), and it must avoid tab bar/FAB/keyboard with real clamping (needs vv/safe-area clamps, `useKeyboardInset`), so more code.
C. **Hybrid** (free drag while holding, snap on release, plus a one-time hint at first launch/first drag). Best UX, A+B cost, extra "hint seen" flag in the settings store.
**Recommendation: A for the lowest risk/effort now** (apply x translation in the drag using `motion` `x`, snap on release; `side` stored the same, so persistence and `AIChat` geometry stay unchanged), then upgrade to C later if the Council wants free placement. Whichever is chosen, include: clamp using `visualViewport` and `env()` insets, fix `fit()` to not rewrite on keyboard, `data-no-ptr` kept, edge-back swipe ignores the orb, a keyboard/screen-reader "move" action, and logical start/end reasoning documented for RTL.

| Proposed solution | Files: `AIChatBubble.tsx` (drag + snap + clamp), `useSettingsStore.ts` (hint-seen flag only if C), i18n copy for the hint. No migration. Reuses nudge bubble, `data-no-ptr`, existing store. |
| Regression risk | Tap-vs-drag threshold (4px, `:114`) must remain; nudge placement uses `orb.side`; chat panel anchors to `orb.side/top` (`AIChat.tsx:72-77`), unchanged if the store shape is unchanged; the 400ms ghost-click grace (`project_fab_ghost_click`) is for ModalShell, not touched. |
| Test that proves it | Extract the pure position function (`orbFromPointer`) and unit test: x past midline yields right, clamp respects safe-area and keyboard inset; existing `buddgyOrbDefault.test.ts` stays green. Owner review for the feel. |
| Shared causes | BDG-014 (`fit()` persisting), BDG-017 (left-edge zone). |

---

## Existing tests covering the area
`src/lib/navigation/backGuard.test.ts`, `navigate.test.ts`, `isTabActive.test.ts`, `src/components/layout/pullToRefreshLogic.test.ts` (`data-no-ptr`), `src/components/features/ai-chat/AIChatComposer.test.tsx`, `src/lib/store/buddgyOrbDefault.test.ts`, `SettingsSubPageShell.test.tsx`; e2e: `e2e/journeys/specs/g-buddgy.spec.ts`, `n-navigation.spec.ts`; `e2e/ui/sheets.mjs`, `focus.mjs`. None simulates a soft keyboard or an edge swipe.

## Queries for the lead
None (no database dependency).

## Decisions that need the owner
1. Back semantics for non-tab screens: always `history.back()` or a fixed parent (profile menu / Flow)?
2. Ship a visible back button on Goals, Reports, Subscriptions, Notifications, Budget plan, Settings hub in addition to the gesture?
3. Accept "no native build" for the edge-swipe (JS) vs a native recognizer?
4. Device test of BDG-014 on iOS 146 before/after.

## Decisions that need Council
BDG-018: A (side-to-side + hint), B (free drag + snap), or C (hybrid). Recommendation: A.
