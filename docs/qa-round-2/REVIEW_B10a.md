# REVIEW B10a (accessibility + tokens), adversarial, read-only

No blockers found. Portals into body make inertBackground safe for the common cases: toasts, NumberPad, date picker, Base UI popups, CardActionMenu and the AlertDialog are all mounted after the sheet effect runs, so none is inerted. `ActionToastProvider` renders its region as a direct body child, so a toast shown while a sheet is open is also not inert.

## MEDIUM
1. src/components/modals/ModalShell.tsx:32-46 (inertBackground), :205-207. No ref-counting. `child.hasAttribute('inert') -> continue` means a second sheet never claims the app root.
   Scenario A: sheet A open (owns root inert), sheet B opens before A closes (overlap or delayed handoff), A closes. A's cleanup strips inert from the root while B is still open, so the page behind B is focusable and readable again.
   Scenario B: two ModalShells committed in the same render. The first effect inerts the second's already-committed panel and backdrop. The second's `child.contains(panel) -> continue` never clears it, so sheet 2 is dead until sheet 1 closes. Seen in the same-commit pattern only (e.g. PaymentMethodSetupSheet shell+provider stack if both open at once).
   Fix: module-level Map<Element, count>, increment on mark, remove inert only at 0. Skip any element carrying a `data-modal-layer` attribute on panel and backdrop.
2. src/components/modals/ModalShell.tsx:209 (focus restore). The backdrop is now a focusable <button tabIndex=-1>. In Chrome/Android a click on it focuses it, so on close activeElement is neither body nor inside el and the `opener.focus()` is skipped. Focus drops to body after every backdrop dismiss.
   Fix: also restore when `document.activeElement?.hasAttribute('data-modal-backdrop')`.
   Related: Shift+Tab from the backdrop escapes the trap (listener is on the panel only). Minor.

## LOW
3. Collateral inert while a sheet is open: UpdateToast (reload button), OfflineBanner and UpdateGate are body-level siblings of the app root, so they go inert. The PaymentMethodSetupSheet card-preview portal (:523) is inerted by any nested sheet. Display-only today. Fix: add `data-inert-exempt` on UpdateToast/OfflineBanner and skip it in the walk.
4. src/components/features/expenses/ExpenseSheetForm.tsx:423, EditExpenseForm.tsx:75 (L20 Delete). Same removeExpense as the swipe path, so the linked-debt confirm, the Undo snapshot and restoreExpense (idempotent) all match. Gaps:
   - The button stays mounted for the ~260ms exit animation. A double tap on an unlinked expense shows 2 Undo toasts. On a linked expense it queues 2 confirms, and the second runs after the first deletes and returns false.
   - Unlinked delete has no confirm, and the button sits mid-form above Note, so a mistap is easy (Undo toast softens it).
   Fix: a `deleting` ref guard or disable-on-click. Consider moving the button to the footer.
5. src/lib/ui/hitArea.ts, buttonVariants.ts:34-46. The 44px ::after is part of the later sibling and paints above the earlier one. Tight groups (xs/icon-xs 24px with gap <=4px, button-group with -ml-px) lose 2-6px of the earlier button's edge to its neighbour. `overflow-hidden` on a Button or its row clips the extra area back to the visual box, so it is harmless but gives no gain there. `relative` is added to every sized variant, so any caller that sets `absolute`/`fixed`/`sticky` must go through cn() (twMerge). I found no raw `buttonVariants(...)` string concatenation, so that part is fine.
6. src/components/layout/DesktopHeaderBar.tsx:39,49. On mobile the header <h1> coexists with page h1s (SettingsSubPageShell, notifications page, Studio, CreateChooser), giving 2 h1 below lg. At lg the desktop h1 plus the page h1 also double up (notifications is excluded, settings sub-pages are not). Fix: demote the shell h1 to a <p role="heading" aria-level=...> or drop it where the page owns an h1.
7. role="alert" additions (23 total). AuthOAuthButtons:54 and AuthFormErrorAlert:22 already had or now have alerts. If both an OAuth error and a form error render together, the user hears two alerts. Not reproduced, no shared parent live region found. Mount-time alerts inside a newly opened sheet are announced once; acceptable.
8. z tokens. PaymentMethodSetupSheet:231 nested currency sheet is z-[140], equal to --z-dialog 140. The dialog popup is 141 and its portal is appended later, so it wins, but it is DOM-order dependent. Select/Popover/DropdownMenu stay at z-[120] (popover.tsx:35, select-internals:113, SelectField:133), which sits under the nested provider/card/currency sheets (130/135/140). That is pre-existing, but the new tokens do not fix it. The --z-sheet/--z-picker tokens are used only by NumberPad and UnifiedDatePicker. UpdateToast moved 100->200 so it now covers sheets (intended).

## CHECKED, OK
- Reduced-motion global rule: no animationend/transitionend/onAnimationEnd listeners anywhere in src. Base UI waits on getAnimations(), which resolves immediately with animation:none. Spinners are untouched. Only .animate-pulse/.animate-bounce/animate-in/out are killed. Inline `style.animation` (date picker) is unaffected.
- Toast 4s: timers are per-card refs, pause/resume is intact, MAX_TOASTS=3 never drops an Undo toast, test updated.
- Focus-ring token: --color-brand-focus is used for non-focus fills only as the AmountField active border (intentional). Dark value is unchanged (#1FC3B2). The new light value is covered by globalsContrast.test.ts. SelectField search Combobox.Input (SelectField.tsx:152) still has outline-none and no ring, as required.
- Focus ring is now full alpha 3px ring-3 on inputs: a heavier look, a design call, not a bug.
- authModalTokens focus changed from neutral to brand-focus, consistent with globals.css comment; note the memory "neutral focus ring" convention is now superseded.
- aria-label on logo links, BottomNav aria-label/aria-current, backdrop button (type=button, no form ancestor): fine.
- Back-guard / Escape LIFO unaffected (inert does not touch registerBackGuard).
- Nested sheet B close correctly un-inerts A's panel and backdrop, and restoreBackground runs before opener.focus().
