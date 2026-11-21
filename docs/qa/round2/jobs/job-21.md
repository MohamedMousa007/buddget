# QA job 21: Arabic brand copy + 1.0.0 version reset

- Branch `claude/risk-based-testing-philosophy-9bacd9` at `35a4d72e` (detached checkout, no app code changed)
- Runner: cloud qa-runner, 2026-11-21, `Africa/Cairo`, `next dev -p 3100 --webpack`, `NEXT_PUBLIC_DEV_AUTH_BYPASS=0`, empty `NEXT_PUBLIC_API_BASE_URL`, workers 1, retries 0
- Live env vars: present (from the environment, no `.env.local` in the checkout). No Supabase MCP, no `execute_sql`.

## Verdict: PASS, with copy findings for the developer to decide (no test failures)

| # | Item | Result |
|---|---|---|
| 1 | `npm run verify` (full gate) | **PASS**: lint, types, vitest Cairo with coverage (770 files passed, 7 skipped; 6996 tests passed, 181 skipped), vitest New York (same counts), migrations, dependency audit, production build. `All checks passed.` |
| 2 | vitest on `src/lib/i18n`, `src/lib/email`, `src/lib/site`, `src/lib/server/clientGate.test.ts`, `src/lib/admin` | **PASS**: 28 files, 183 tests |
| 3 | Arabic UI sweep | **PASS** for overflow and letter joining. **5 Latin-word hit groups listed below** (no test fails on them; they look deliberate, so the developer should confirm) |
| 4 | Journeys R11 (invite landing) and g-buddgy | **PASS** for both (R11 47.5 s, g-buddgy 58.4 s). g-buddgy's first two attempts were infra failures, not app failures (details below) |
| 5 | Synthetic user cleanup | **PASS**: 0 `qa-e2e-*@buddget-qa.test` users left (count only) |

## 1. Gate
Log tail: `== production build (dummy Supabase env)` → `All checks passed.` → exit 0. No failing tests.

## 2. Targeted vitest
Files that ran include `i18n/membershipCopy`, `rewardsCopy`, `usageCopy`, `dictionaryParity`, `arPluralCoverage`, `buddgyChatCopy`, `localeCookie`, `email/email`, `email/secretPlacement`, `site/entry`, `server/clientGate`, `admin/minVersion` and 7 other admin tests. All green.

## 3. Arabic UI sweep
Method: `e2e/ui/sweep.mjs` does not check text, so I used a one-off script based on `e2e/ui/pro-rewards-sweep.mjs` (same sign-in, seeding and API routing). It was not committed. It ran two fresh users, Pro/Diamond and Free (on a 30-day trial), with `user_settings.language = 'ar'`, at 375 and 1440 wide, light theme. Routes: `/settings` (hub plus the membership card), `/settings/pro`, `/settings/rewards`, `/settings/sms`, `/legal/privacy`, `/legal/terms`, `/ar/legal/privacy`, `/ar/legal/terms`. On each page it checked:
- horizontal scroll, and Arabic text clipped (`scrollWidth > clientWidth` with clipping or ellipsis) or off screen;
- letter joining: Arabic letters split across inline elements inside one block, and non-zero `letter-spacing` on Arabic text;
- the regex `\b(buddget|Buddgy|Pro|PRO|Sparks?)\b` against the rendered `main` text.

Results:
- **Overflow: none.** No horizontal scroll and no clipped or off-screen Arabic text on any route or width.
- **Letter joining: no breaks.** The one flagged split, in the terms text `(«الشروط») و|سياسة الخصوصية`, is a false positive: و never joins to the next letter. Small negative `letter-spacing` sits on Arabic headings (`/settings/pro`: STRONG -0.46px "مستخدم", H3 -0.42px "أنت ضمن حدود المجاني حتى الآن"; `/settings/rewards`: H3 -0.16px). It is visually fine in the screenshots and joining is intact. Logged for information only.
- **SMS tracking guide (`/settings/sms`):** on web this route sends you to `/settings` by design; the guide shows only inside the iOS app. With the Capacitor bridge faked, the app showed the native sign-in screen instead, so the guide was **not rendered**. Its copy was checked statically instead (below). The rendered guide needs **Native verification**.

### Latin brand words in the rendered Arabic text
| Where | Text | Source | Note |
|---|---|---|---|
| Settings hub membership card, `/settings/pro` hero and member card, avatar tag | `PRO`, `PRO TRIAL` (gold mark) | `src/lib/i18n/membershipCopy.ts:429` `mark: 'PRO'`; `src/lib/i18n/rewardsCopy.ts:676-677` `markPro`/`markTrial`; `rewardsCopy.ar.profile.proTag` | Deliberate brand mark? `rewardsCopy.test.ts` only blocks `\bPro\b`, so upper-case `PRO` passes |
| `/settings/rewards` tier ladder (Elite, Founders Elite) | `PRO` chip, shown as `النخبةPRO` in innerText | `rewardsCopy.ar.rewards.pro` | Same mark. Visually a separate chip, not glued (screenshot checked) |
| Member card and app header | `buddget` wordmark | logo graphic or text in the card component, not i18n | Logo, likely fine |
| `/legal/privacy`, `/ar/legal/privacy` | «بادجت» (buddget), «بادجي» (Buddgy), `support@buddget.app` ×6, `buddget.app` | Arabic legal sections | Brand in parentheses after the Arabic name, plus email and domain: looks deliberate |
| `/legal/terms`, `/ar/legal/terms` | «بادجت» (buddget), `support@buddget.app` ×3, `buddget.app` | Arabic legal sections | Same |

### Static scan of every Arabic copy string (backs up the SMS guide check)
I loaded every module under `src/lib/i18n/**`, `src/lib/site/**` (except `fonts.ts`) and `src/lib/email/defaults.ts` through a temporary vitest file, deleted afterwards. 17,408 strings, 8,690 of them Arabic, gave 13 hits:
- `ar.ts` `smsTracking.guide.testMessage()` → `buddget test X`. **This is in the SMS guide.** It is probably the keyword the Shortcut matches on, so it is functional rather than copy; the developer should confirm.
- `ar.ts` `profile.avatarCameraBlockedBody` → `… ← التطبيقات ← buddget ← الأذونات …`. Names the app as iOS Settings lists it, probably deliberate.
- `membershipCopy.ar.billing.steps.appStore.1` → `اضغط على الاشتراكات ثم buddget Pro.` and `…playStore.2` → `اختر buddget Pro ثم إلغاء.` These name the subscription as the stores list it. **Uses mixed-case `Pro`**, but the test passes because it covers `rewardsCopy` only, not `membershipCopy`.
- The `PRO`/`PRO TRIAL` marks above (4), `settingsHubCopy.ar.help.web/contact` (domain and email), and `siteContent.ar.press/ai facts` (email).
- `src/lib/email/defaults.ts`: no hits.

### Other observations (not regressions from this change)
- **English flash on in-app legal pages:** `/legal/privacy` and `/legal/terms`, with the account set to Arabic and `data-locale="ar"`, first render the English document. They switch to Arabic about 2 to 4.5 s later in dev mode. `LegalLocale` reads the settings store, which hydrates after first paint. Probe: privacy t=2.5 s `h1 "Privacy Policy"` → t=4.5 s `"سياسة الخصوصية"`; terms (second visit) English until t=6.5 s. The `/ar/legal/*` routes are always Arabic straight away. Production timing is not measured here.
- **English legal footer under the Arabic sign-in screen:** `src/components/auth/LandingGate.tsx:140-147` hardcodes `Privacy Policy · Terms of Service`. Seen on the native sign-in gate while the iOS bridge was faked. It was already there at f16d0e18 and is not a brand word, but it is English on an Arabic screen. `LegalFrame` already has `LegalLabel en/ar` for this.
- Member card dates show Latin month names (`21 NOV 2026`) in Arabic. Likely a deliberate card style.

## 4. Journeys
- `r1-core.spec.ts:221` R11 invite landing: **passed**.
- `g-buddgy.spec.ts:11` G Buddgy request > approve > verify > undo: **passed** on the third attempt. Attempts 1 and 2 were infra problems:
  1. `ENOENT … .env.local` at `e2e/journeys/lib/env.ts:9`. The helper requires the file even when the env vars are already set; I worked around it with an empty `.env.local`, removed afterwards.
  2. `locator.fill: Timeout 30000ms exceeded` at `e2e/journeys/lib/fixtures.ts:45`, page stuck on "Loading…". The dev server logged `Reload env: .env.local` and then `⚠ Server is approaching the used memory threshold, restarting...` in the middle of the test. After a warm-up the next run passed.
  - Side effect: when sign-in fails inside the `user` fixture (`fixtures.ts:27`), the synthetic user is not deleted, because the delete runs after `use()`. 2 users were left this way and removed in item 5.

## 5. Cleanup
I removed the 2 leftover users through the auth admin API (service role, ids only). Count of `qa-e2e-*@buddget-qa.test` afterwards: **0**. The sweep users deleted themselves (HTTP 200).

## Labels
- **Automated verification:** items 1, 2, 4, 5, and overflow and joining in item 3.
- **Manual verification required:** whether the `PRO`/`PRO TRIAL` marks, `buddget Pro` in the store-cancel steps, and `buddget test X` are meant to stay Latin.
- **Native verification required:** the rendered iOS SMS tracking guide in Arabic.
