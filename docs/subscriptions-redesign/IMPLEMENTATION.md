# Subscriptions redesign: implementation report

Source: `design/handoff 2` (SPEC.md, screens, prototype). Applied 2026-10-18.

## Replaced / reused
- Replaced: `/subscriptions` page, `SubscriptionCard*`, `SubscriptionCatalogGrid`, `SubscriptionPlanPicker`, `AddSubscriptionSheet` + configure view, `BudgetCommittedCard`, detection banner (now one "Found N possible subscriptions · Review" prompt), `SubscriptionBrandIcon` (now `BrandTile`).
- Reused: `Button`, `OptionChip`, `SegmentedControl`, `SelectableCard`, `Switch`, `Card`, `Badge` (StatusChip), `ModalShell`, `IconButton`, prompt stack, catalog (`subscriptionCatalog.ts`), recurrence engine, SMS matcher.

## Migration note (applied to project ydihurtbcnoflhormgzi)
- `0114_subscriptions_redesign_fields`: `subscription_billing_cycle` += `semiannual`; `subscriptions` += `tracking` (sms|ask|log, default sms), `reminder`, `trial_end`, `ends_on`, `paused_at`, `price_history` jsonb, `pending_plan_from`, `shared_with` text[], `my_share`.
- `0115_user_settings_subscription_alerts`: `user_settings` += `sub_due_reminders`, `sub_price_alerts` (default true).
- Additive only; existing rows keep working (new fields optional in the store, defaults applied by helpers). `database.types.ts` patched to match.
- Behaviour changes: trials no longer count in the monthly total (audit O10); `cancelSubscription(id, endsOn)`; SMS dispatch now also writes `pending_plan_from`; "Mark paid" and `log` mode write linked expenses (`isRecurring`, no `smsLogId`) that an incoming SMS charge replaces.

## Deviations from the screenshots (and why)
1. **Logos**: only brands the repo logo policy allows show a logo (38); the rest get initials. The handoff shows more logos (Anghami, Apple Music, ChatGPT…); the policy is the legal gate from commit 132df442.
2. **Catalog**: repo catalog (117 brands, verified 2026-10-17) is used, not `catalog.json`; prices therefore differ in places (e.g. ChatGPT Plus 999.99 EGP in Egypt, Xbox/PlayStation without Egypt plans). Cancel hints are imported from `catalog.json`.
3. **Paid with**: chips list the user's own payment methods (a ledger account id is required), not rail types (Card, Carrier billing, Fawry…).
4. **Add step 1**: no category chip is pre-selected; the grid is the "Popular in Egypt" mix, chips filter on tap. Step 2 has a back chevron in the header (a wrong tile tap was otherwise unrecoverable).
5. **Unlocated profile** defaults to the Egypt catalog.
6. **Offline banner** is the app's global status pill (existing copy), not a new in-page banner.
7. **Layout direction** follows the app (`dir=ltr` always, logical properties, Arabic text), so frames are not mirrored.
8. **SMS review** infers monthly cycle only (no yearly/"billed in USD" line); confidence is High at 3+ months, Medium otherwise.
9. **Quick add**: a 7th tile joins the existing 2-column grid (design shows 3 tiles).
10. **Budget plan row**: progress strip added under the planner row that maps to Subscription spend; planner rows stay editable inputs. No "fixed items" (Rent) exist in the app, so the Committed card holds subscriptions only.
11. Extra copy not in SPEC §9 is marked `// ext:` in `src/lib/i18n/subscriptionsCopy.ts`.

## Not verified
- No Storybook in this repo; screenshots of home/detail/add/dark/AR/desktop were checked in the browser pane, not committed as tests.
- Cron digest/trial/price alerts are unit-tested, not run against live data. Native builds not dispatched.

## Acceptance checklist (SPEC §11)
1. Hero 191 px loading/empty/data: pass (measured 239 = 48 + 191). 2. Row content: pass. 3. Tracking icon/detail/change/default SMS: pass. 4. Lifecycle row + detail states: pass (failed-payment derives from a declined linked charge). 5. Trial excluded from Committed, paused/cancelled silent: pass. 6. Left-to-pay from due dates, yearly in set-aside only: pass. 7. SMS sheet absorbs matches, equal 48 px buttons: pass. 8. Empty state: pass (tiles depend on catalog region). 9. Add step 1/2 with impact line: pass (deviation 4). 10. USD plan ≈ EGP, refined after first charge: pass. 11. Red only destructive/over-plan: pass. 12. `rotate-cw-clock` in Budget entry, plan row, Quick add, sidebar, Flow: pass. 13. Dark + Arabic: pass (not mirrored, deviation 7). 14. Desktop rail with strip + max two insights, 28 rem dialogs: pass. 15. Offline: pass (all local; sync later).
