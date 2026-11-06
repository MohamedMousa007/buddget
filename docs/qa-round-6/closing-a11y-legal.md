# QA Round 6: closing status, a11y / admin-site legal / locale (fixer: a11y-legal)

No migrations were needed (0248, 0249 unused). Tests: `src/components/ui/a11yFixes.test.tsx`, `src/lib/ui/contrast.test.ts`, `src/app/globalsContrast.test.ts` (extended), `src/lib/legal/legalRoutes.test.tsx`, `src/lib/legal/storeDocs.test.ts`. `npx tsc --noEmit` clean; vitest over components, app, lib/i18n, lib/ui, lib/payment, lib/site, lib/legal, hooks all green (2 existing tests updated for the rem and legal-frame changes).

| ID | Status | What changed |
|---|---|---|
| A11-1 | Fixed | New tokens `--color-brand-on-red/-green/-amber` (light `#FFFFFF`, dark `#04201C`) plus theme-independent `--color-brand-ink-light/-dark` in `globals.css`. Used by `buttonVariants` (`success`, `destructive-solid`), `ActionToast`, `SwipeToDelete` (both panels), `PullToRefresh`, `AmountReceivedSheet`, `PromptBanner` icons, the selected-check badge on the carousel card. `globalsContrast.test.ts` computes fill and hover ratios from the CSS for both themes (>= 4.5), and a source guard fails on any `text-white` over a red/green/amber fill. |
| A11-2 | Fixed | `src/lib/ui/contrast.ts` (`cardFace`, `inkFor`, WCAG maths). `PaymentCardCarousel`, `PaymentMethodSetupSheet` preview and `CardFaceChip` take their ink from the card colour; `cardGradient` keeps the same sheen but clamps a stop only where the ink would drop under 4.5:1. All 25 `CARD_COLORS` reach >= 4.5:1 at the light, middle and dark stops (tested). `inkOn()` (accounts) now uses the same maths and no longer returns the theme text colour, which was near-white in dark mode (bug fix, tested). Decision: the alpha-white small labels are now solid ink. |
| A11-3 | Fixed | `AuthOtpRow`: `role="group"` named "Verification code", each box "Digit N of 6" (EN+AR in `a11y.otpDigit/otpCode`), `autoComplete="one-time-code"` kept (first box and the rest), Arabic-Indic digits typed or pasted are normalised (also closes TZL-4 for the OTP). |
| A11-4 | Fixed | `ZakatSheet` `lineInput(id, live, label)` adds `aria-label` (asset name, debts); `AmountReceivedSheet` amount and `UnifiedDatePicker` year search named. |
| A11-5 | Fixed | `ColorSwatchRow`: `radiogroup`/`radio` + `aria-checked`, selected swatch drawn with a `--color-brand-focus` ring and a check in a readable ink (visible in both themes, not colour-only), 44px hit area via `HIT_AREA` (also A11-17 swatches). Unselected look unchanged. |
| A11-6 | Fixed | `SegmentedControl`: arrows/Home/End move selection and DOM focus (`segmentedNav.nextSegmentIndex`, tested) with the roving tabindex. |
| A11-7 | Fixed | `RouteAnnouncer` (document.title from the view `h1`, persistent polite live region, focus to `<main id="main-content" tabIndex=-1>` unless a dialog is open or the user is typing) and `SkipLink` (EN+AR `a11y.skipToContent`) mounted in `AppShell`. Pure logic in `routeAnnounce.ts`. Not exercised in a real browser: live check L8. |
| A11-8 | Fixed (needs on-device verify) | 536 `text-[Npx]` classes up to 15px converted to the identical rem value across 183 files (visually unchanged at the 16px root; guard test forbids new ones; larger display sizes and `fitText.ts` left as px). `BuddgetViewController.swift`: root font size follows Dynamic Type (`UIFontMetrics`, 16px at the default size, capped 1.5x) at document start and on `UIContentSizeCategory` change. Pinch zoom stays off by design. Not built or run (no native build per rules): verify on a device with a larger text size. Inline `style={{ fontSize: n }}` values were not converted. |
| ADS-9 | Fixed | Language order: URL first, then app setting. New `/ar/legal/privacy` and `/ar/legal/terms` (`(site-ar)/ar/legal/*`, Arabic in the server HTML, `lang=ar dir=rtl`); `/legal/*` stays the English store URL and follows the app setting. `lib/legal/paths.ts` is the single source for paths, hreflang (`en`, `ar-EG`, `x-default`) and canonicals; `LegalLocaleProvider`/`LegalDocLink`/`LegalFrame` in `components/legal`; page bodies extracted to `PrivacyDocument`/`TermsDocument`. Arabic site footer and security page link to `/ar/legal/*`, English to `/legal/*`; cross-links inside the Arabic pages stay on `/ar/legal/*`; in-app links stay `/legal/*` because the site groups are stashed from the native bundle. Sitemap lists both languages with alternates. "Last updated" dates bumped to November 5, 2026 (closes ADS-10 for the pages and sitemap). Tests check every rendered legal link against the route table. |
| ADS-8 | Fixed | `docs/GOOGLE_PLAY_SUBMISSION.md`: permission block now equals the real manifest (no `READ_SMS`, no notification listener, adds FOREGROUND_SERVICE*, RECEIVE_BOOT_COMPLETED, MODIFY_AUDIO_SETTINGS), SMS justification rewritten to match (on-device gate, server-side parse, scheduled masking), Data safety section now maps `docs/STORE_PRIVACY.md` (the single source) onto Play categories incl. phone number, user ids, device ids, analytics, crash logs, SMS, financial, photos, audio, policy URLs fixed. `storeDocs.test.ts` fails if the doc and manifest drift. |

Also closed on the way: TZL-4 (OTP, year search, last-4, due-day inputs normalise Arabic digits), A11-17 (swatch hit area), ADS-10 (pages and sitemap dates).

TZL-2 / TZL-1 / TZL-3 were already closed by the dates fixer (`closing-dates.md`); ADS-1 / ADS-7 by `closing-security.md`.

## Owner questions (from ADS-8, not decidable from the code)
1. SMS sender numbers: the on-device gate can forward a personal number when the text matches a transaction keyword; decide whether the SMS row should also say the sender address is collected.
2. Receipt images go to Gemini: confirm the provider retention terms still support "not kept".
3. Play `RECEIVE_SMS` Permissions Declaration approval is still required before the Android build is accepted.

## Owner actions (not touched)
SUP-1 (disabled Linear bot), SUP-2 (`.claude/settings.json`), SUP-4 (Firebase key restriction in the console).

## Still open (P3, not in scope)
A11-9..16, A11-18..20, TZL-5..9 untouched.
