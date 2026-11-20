# Findings E: invitation cards, referrals, rewards (BDG-003 to BDG-007)

Read-only investigation at `origin/main` (worktree HEAD `3d65b36f`). Store builds iOS 146 / Android vc180 were cut at `75e4ce8c`. `claude/wizardly-elion-081241` (0330/0332/0333) is already merged into `origin/main` (`git merge-base --is-ancestor` true), so every migration quoted below is on main. No unmerged branch touches `FlipCardRig`, `cards.module.css`, `rewardsCopy.ts`, `HotStreakCard` or the invite code.

Shared facts used by several issues:
- There is NO `/i/` landing page. `src/app/i/[code]/route.ts:10-18` only normalises the code, sets a 30-day cookie `buddget_invite`, and 307-redirects to `/flow?next=%2Fflow` (or `/` for a bad code). It makes no database call, so it cannot show an inviter name or an expiry. The brief's "landing page" strings do not exist: the only invite copy lives in `src/lib/i18n/rewardsCopy.ts` (EN block from line ~505, AR block from ~827), not in `dictionaries/en.ts` / `ar.ts`.
- The card is `GuestPassCard` (`src/components/features/membership/GuestPassCard.tsx`) on the shared `FlipCardRig`, rendered from `src/components/features/invite/InviteView.tsx:89-102`.

---

## BDG-003 Back of the invitation card shows front text, mirrored or overlapping

| Field | Content |
|---|---|
| Issue ID | BDG-003 |
| Summary | On a flipped card the front face is still painted (seen from behind, so mirrored) over or under the back face; it is the shared flip rig, so every flipping card is exposed. |
| Severity | P2 (visual, on the new Pro/Rewards/Invite/Founders surfaces; P1 if it hits the Pro card in store builds) |
| Reproducibility | Not reproduced here (no browser run allowed). Owner reports it; expected on WebKit (iOS Safari, iOS WKWebView = the iOS app). Steps: open `/settings/invite` (or `/settings/pro`, `/settings/rewards`, `/settings/founders`), tap the card, wait for the 180 degree turn. |
| Platform | Most likely iOS (WKWebView) and Safari; Chromium/Android WebView probably fine (the mockup and the S8g Chromium sweep passed). Unconfirmed: needs a device or Safari run. |
| Affected components | `src/components/features/membership/cards.module.css:36-39,62` (`.slot`, `.slotBack`, `.face`), `FlipCardRig.tsx:113-120` (structure), `flipPhysics.ts:66-84` (`rigFrame`) |
| Backend dependencies | none |
| Root cause | Confirmed: all four flipping cards (GuestPass, ProMember, LetterpressTier, FounderSignature) render through ONE component, `FlipCardRig` (`GuestPassCard.tsx:66`, `ProMemberCard.tsx:72`, `FounderSignatureCard.tsx:74`, `LetterpressTierCard.tsx:101`) and one stylesheet. The mirrored text is the signature of a face whose `backface-visibility` is not honoured: at 180 degrees the front is seen from behind, so it is mirrored and shares the plane with the back face. Why the hiding fails is a ranked hypothesis, see below. |
| Evidence | See below. |
| Shared causes | Same stack for Pro card (BDG not in my set), Rewards tier card, Founders card. |
| Proposed solution | See below. |
| Regression risk | Low if face visibility is swapped by JS at 90 degrees; touches only `FlipCardRig.tsx`/`flipPhysics.ts`/`cards.module.css`. |
| Test that proves it | Unit: `rigFrame` returns which face is visible (`flip > 90`) and a test pins it. The visual fix itself is "owner review" on a real iPhone/Safari: jsdom cannot test backface behaviour. |
| Confidence | High that the cause is the shared rig and a failing backface hide; medium-low on the exact WebKit trigger. |
| Missing evidence | A Safari/WKWebView run or a screenshot of the broken card. |

### Structure (confirmed, `FlipCardRig.tsx:112-125`, `cards.module.css:33-39`)
```
.rig        perspective:1100px; display:grid          (the stage)
  .lift     transform-style:preserve-3d; will-change:transform (translateY, JS)
    .mcard  transform-style:preserve-3d; dir="ltr"    (rotateY/rotateX/scale, JS)
      .slot       position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden
        .face(CardFace)  position:absolute; inset:0; overflow:hidden; border-radius:18px   (NO backface rule)
          ...text, .grain, .monogram, .sheen, .glare
      .slot.slotBack  transform:rotateY(180deg)
  .hit      flat button outside the 3D tree (tap target)
```
What is right: `preserve-3d` on `.lift` and `.mcard`, `perspective` on the parent, both faces absolute at `inset:0`, `-webkit-backface-visibility` present, the back face pre-rotated 180 degrees, `dir="ltr"` on `.mcard` (so RTL does not mirror or reorder the faces; no `scaleX` anywhere), flip toggled by JS (`toggleTarget` 0/180, a damped spring writing `transform` on `.card` per frame, `FlipCardRig.tsx:54-58,95-100`). No ancestor up the tree flattens the 3D context: `.spot` (`CardSpotlight`) has no overflow/filter/transform, `PageStack`, `PageBody`, `SettingsSubPageShell` have none, `<main>` has `native-scroll` (overflow-scrolling only, no `overflow` set on a transform ancestor), `PullToRefresh` wraps children without a transform (its animated element is a separate fixed sibling, `PullToRefresh.tsx:167`). `.spot::before { filter: blur(10px) }` and `.floor { filter: blur(2px) }` are siblings/pseudo-elements, not ancestors of `.mcard`.

### Ranked hypotheses
1. **(most likely) The hide is on the wrapper, not on the painted face.** `docs/design/pro-rewards/mockup.html:60` puts `backface-visibility:hidden; -webkit-backface-visibility:hidden` on `.face`, the element that owns `overflow:hidden; border-radius` and the children. The port moved it to the transparent wrapper `.slot` (`cards.module.css:37`) and left `.face` (`:62`) without it. Inside each `.face` are descendants that WebKit promotes to their own compositing layer: `.sheen` (a `transform: translateX(var(--sx))` that the rig rewrites every frame, plus `mix-blend-mode: soft-light` in dark, `:67-68`), `.glare` (`mix-blend-mode: soft-light/overlay`, `:71-73`), `.grain` (`mix-blend-mode: overlay`, `:88`), `.paper` (`multiply`, letterpress). WebKit is known to leave a composited child of a `backface-visibility:hidden` ancestor visible when the ancestor itself is flat (not `preserve-3d`), because the child layer carries its own transform state. The visible symptom matches: the front face's content (text and effects) shows through mirrored at 180 degrees, overlapping the back text. HYPOTHESIS: I read the CSS, I did not run Safari.
2. `filter` on the same element as `backface-visibility`: `.dimmed .slot { filter: saturate(.25) brightness(.6) }` (`:40`). Applies only to locked tier cards (Rewards Elite lock), NOT the invite card, so it cannot explain the invite card. Another reason to move the visibility control off `.slot`.
3. Both slots sit on the exact same plane (z=0), and the card also gets `rotateX` wobble and `scale()` (`flipPhysics.ts:78`); when two coplanar layers both fail to hide, front and back z-fight, which explains "overlapping" rather than a clean mirror.
Not the cause: RTL (card forced `dir="ltr"`), missing `-webkit-` prefix (present), absolute positioning (correct), ancestor overflow/filter/opacity (none found).

### Which browsers
By hypothesis 1, WebKit only: iOS Safari and the iOS WKWebView in the Capacitor app (store build 146 was cut from the same code; `a58958a4` already fixed a WebKit hit-test problem on this rig, so WebKit quirks on it are known). Chromium (desktop Chrome, Android WebView) handles backface on flattened parents and passed the S8g sweep (`docs/qa/round2/S8g-pro-rewards.md:250` only mentions the hit-test false positive). Existing tests (`membershipComponents.test.tsx`, jsdom) cannot catch it.

### Proposed solution (suggestion; a simpler and sturdier option exists)
One fix covers all four cards because they share `FlipCardRig`:
- A. Do not rely on `backface-visibility` alone. `rigFrame` already computes `back = r.flip > 90` (`flipPhysics.ts:69`). Have `paint()` in `FlipCardRig.tsx` set `visibility` (or `opacity:0`) on the non-facing slot (`frontSlot`/`backSlot`, refs already exist, `:36-37,57-61`) when it flips past 90 degrees, and keep `backface-visibility` as belt and braces. Reduced motion already swaps at once (`stepRig` reduce branch). This is deterministic on every engine.
- B. Also move/duplicate `backface-visibility: hidden; -webkit-backface-visibility: hidden` onto `.face` as in the mockup, and add `transform: translateZ(0)` to `.slot` so each face is its own 3D-rendered layer.
- C. Move the `.dimmed` filter to `.face` (child) so it never sits on the backface element.
Reuse: only existing files above; no new component. Option A is the smallest and most reliable; B/C are cheap hardening.

---

## BDG-004 / BDG-006 Real reward rules, and every mismatch with the invite copy

### The real rules (from SQL and server code; `0308`, `0312`, `0332`, `0333`, `rules.ts`, redeem route)
All times UTC unless noted.
1. **Friend, headline "37 days"**: 30-day trial (`plans.trial_days` for `plus_trial`, default 30 in `trial_claim`) plus 7 days. Two paths, both only when a valid `referrals` row exists:
   - friend already trialing: `referral_redeem` adds 7 days to `trial_ends_at` immediately (`0333:~52-56`, same as `0332:103-106`);
   - friend has not claimed the trial yet: `trial_claim` grants `trial_days + 7` and marks `trial_bonus_applied` (`0333:99-101`).
   The 7 is not tied to the friend being "active"; the friend keeps it even if they never qualify. It is NOT clawed back.
2. **Friend can lose the 37**: the trial is once per person ever (`trial_claim` refuses a past store plan/event, `0332` "S8G-03"), has a daily cap (`dailyCap` 200 default, counted over real accounts only, `0333`), needs a verified, non-disposable email (`redeem/route.ts:50-52`), and only goes through for an account created after the code existed and within the last 7 days (`referral_redeem`: `account_too_old`). A friend who already used a trial gets `already_claimed` and no 37 days, with no card copy for that case.
3. **Success = "activated"** (`referral_evaluate`, `0332:150-200`): inside the friend's first 14 days, activity on at least 3 distinct local days AND at least 5 records created (expenses + income events, by `created_at`, deleted rows excluded). Checked nightly by cron `/api/cron/loyalty` and on the friend's app open (`rewards_touch`). Sign-up alone earns nothing. Past 14 days without it the row becomes `expired`.
4. **Extra gates before the inviter is paid** (`referral_reward`, `0332:219-`): the friend must have a non-revoked iOS or Android device (a web-only friend is `held` with reason `awaiting_native` until they sign in on a phone, expiring after 30 days with `no_native_device`); not the same device as the inviter (`self_device`); one reward per device (`device_used`); rows flagged by network signals (`inviter_network`, or 3+ friends from one network in 30 days, `0333`) are `held` for manual review. Redeem also rejects: `disabled`, `invalid_code`, `self_invite` (own code or shared device), `account_too_old`, `already_redeemed` (same account OR same mailbox ever, `referrals_invitee_mailbox_key`), `device_used`, `unverified`, `disposable_email`.
5. **Inviter reward**: 7 banked Pro days (`pro_promo_grants`, source `referral`), or 500 reward Sparks if the inviter is currently a paying store subscriber (`referral_reward`). Banked days start when the inviter's current trial/Pro ends (`promo_apply_banked`: returns 0 while a non-promo plan still grants access) or extend a running promo at once. Caps: 4 rewards per calendar month and 12 per calendar year, UTC; over the cap the friend is `capped` and the inviter gets nothing for that friend (still counts toward milestones). Milestones on activated friends: 3 = +50 points, 5 = +100 points, 10 = the Connector card finish. Clawback if the friend deletes the account within 30 days of sign-up (`referrals_on_invitee_deleted`).
6. **Existing users / reuse / self-referral**: existing users blocked (7-day account age, account newer than the code); self-referral blocked by code owner, device and mailbox; reuse blocked (`referrals.invitee_id` unique, mailbox unique index, one reward per device); a code itself is reusable by any number of different new friends (no per-code limit apart from the inviter caps).
7. **Friend who never qualifies**: keeps trial + 7 days; inviter gets nothing; row ends `expired` (14-day window) or `expired/no_native_device` (30 days).

### Mismatches (copy: `src/lib/i18n/rewardsCopy.ts`, EN then AR)
| # | String | Where | Problem |
|---|---|---|---|
| 1 | `steps[2]` "They use buddget on 3 days in their first 2 weeks: you get a week" (EN ~548, AR ~888) | Invite "How it works" | Omits the 5-record requirement that `fine` and the SQL include. Contradicts `fine` on the same screen. |
| 2 | `pass.title` "37 days of Pro, on {first}" / `heroGive` "Give 37 days of Pro" / `shareText` "get 37 days of Pro, no card needed" / `signup.hint` "A friend's code gives you 37 days of Pro, no card." | card, hero, share message, sign-up field | Unconditional. Not true for a friend who already used a trial or hits the daily cap (rule 2). Also the 37 only applies to a verified non-disposable email. |
| 3 | `fine` "New accounts on a new phone only." | Invite footer | Closest to the rules but wrong in detail: a web sign-up is accepted and the friend is held until a phone sign-in within 30 days, and the actual redeem limit is "account made within 7 days", not stated. |
| 4 | `heroSub`, `pill` "Free for both of you" | hero | "Free for both" is loose: the inviter's week starts only after their trial or Pro ends, and is 500 Sparks for a paying subscriber. `earned.startsLater` covers this lower down; the hero does not. |
| 5 | `friend.onItsWay` for status `activated` | friend row | `activated` can also be a held row (`awaiting_native`, `review`); "On its way" implies certain payout. |
| 6 | `friend.notCounted` | friend row | Covers rejected, revoked, clawed_back with no reason. |
| 7 | `pass.friendValue` "30 + 7 DAYS", `youWeek` "1 WEEK", `youSparks` "500 SPARKS", `backMark` "WHAT THEY GET", `mark` "GUEST PASS" | AR dictionary (lines ~840-850) | Left in English in the Arabic locale (cards.module.css deliberately letter-spaces them; only the AR letter-spacing is removed). Arabic users see English on the card face. |
| 8 | `pass.benefits[2]` "37 days free, then Free or Pro: their choice" | card back | OK in fact (a default trial has no store card, falls to Free), keep. |
| 9 | `signup.hint` and the `/i/` redirect | sign-up | No inviter name or reward shown to the friend: the route is a bare redirect. |

Everything else checks out against the SQL: month/year caps 4/12, banked "starts when your trial or Pro time ends", 500 Sparks for store subscribers, `earned` figures, milestones 3/5/10 (50, 100, Connector).

### "From" value and the code
- The inviter's real first name IS available to the card: `InviteView.tsx:53` reads `useFinanceStore((s) => s.profile.name)` first word (already used in `pass.title(first)`; falls back to "on me"). The viewer of the card is the inviter, so "From Layla" needs no server work. The full pass title currently is "37 days of Pro, on Layla"; "From [name]" is a one-line change in `GuestPassCardFront`/copy.
- On a shared image or a landing page the recipient is a different person with no name data: `/i/<code>` does no lookup (see above). Options: encode the first name in the image at share time (free, client-side, no server), or add a read-only RPC that returns first name for a code (only a first word; `referral_my_summary` already exposes friends' first names the same way, `0308`). Do not expose email or surname. The code prefix already carries up to 6 letters of the display name (`referral_ensure_code`, `0308`), e.g. `LAYLA-7K2`, so the name is partly visible already; non-Latin names fall back to `BUDDY`.
- Code format today: DB check `^[A-Z0-9]{2,8}-[A-Z0-9]{3,5}$` (`0308`); generated as up to 6 Latin letters of the first name, a dash, 3 random characters from 31 look-alike-free chars (5 after 8 collisions). Client regex is looser `^[A-Z0-9]{1,12}-[A-Z0-9]{2,8}$` (`inviteCode.ts`). Typical length 8 to 10 characters ("LAYLA-7K2", "MOHAME-7K2"). Set in mono with `letter-spacing:.14em` at 13px in a 1.15fr-column (`cards.module.css:.cfacts b.code`), in a 3-column fact row, so it is the widest item on the card.
- "Much shorter sample code" can mean two different things (ask the owner): (a) the sample text shown on artwork/the gallery/placeholder (`signup.placeholder` is `LAYLA-7K2`) can be shortened freely, no rule impact; (b) the real code. Shortening the real code does not weaken the anti-abuse rules because code secrecy is not a control: the controls are verified non-disposable mailbox uniqueness, device and network checks, the native-device gate, caps, and the rate limits `20 per 10 min per user, 300 per hour per IP` (`redeem/route.ts:36-38`). A code with 3 random chars (31^3 = 29,791 combinations) is enumerable by an attacker, but all that buys is picking which valid inviter to attribute to (the friend still must be a new, unique, verified mailbox). Safe options: drop the name prefix and use 5 random chars (31^5 = 28.6M); or keep stored codes as is and display only the part after the dash plus the name. Changing the stored format needs a migration to relax/replace the `referral_codes.code` check, a matching `normalizeInviteCode` change, a backfill decision for existing codes, and `/i/` links already shared with long codes must keep working.

### Proposed solution
- Copy fixes in `rewardsCopy.ts` EN and AR for mismatches 1, 3, 4, 5, 6 (pure strings; `rewardsCopy.test.ts` and `dictionaryParity.test.ts` guard parity). Do not change economics.
- Mismatch 7: translate those labels in the AR block and drop the hard-coded English from card faces (they are all passed as strings through `GuestPassCard` props, so no component change).
- BDG-004 layout: headline "37 Days of Pro" stays in `GuestPassCardFront`; "From {first}" replaces the subtitle; the code shows in the facts row; the "Invite a friend and you both earn an extra week of Pro" line is NOT accurate as written (the friend gets the +7 as part of the 37 at sign-up, the inviter gets a week later only if the friend qualifies; a paying subscriber gets 500 Sparks not a week). Use "Invite a friend. When they stick with buddget, you earn a week of Pro." or the Sparks variant, which `inviteReward(me)` already selects.
- Reuse: `GuestPassCard`, `CardFacts`, `useRewardsCopy`, `inviteReward`.
- Regression risk: low (strings plus one card layout); card height is fixed at 1.586 aspect, text must fit (`cards.module.css:.cname`, 21px title).
- Test: add a unit test in `rewardsCopy.test.ts` that `steps` mentions the records requirement; layout is "owner review". Existing coverage: `inviteCode.test.ts`, `rewardsCopy.test.ts`, `membershipComponents.test.tsx`, `src/lib/referrals/rules.test.ts` (pins `rules.ts`), `src/app/api/referrals/redeem/route.test.ts`, `e2e/api/round2/pro-rewards/40-referrals.spec.ts`, `e2e/journeys/specs/round2/pro-rewards/10-screens.spec.ts`.
- Confidence: high on rules (read from SQL); high on mismatches 1,2,7; medium on 3 (wording judgement).
- Missing evidence: live `plans.trial_days` value and `platform_settings.referrals` state (query below).

---

## BDG-005 Share the invitation as an image, valid for three days

| Field | Content |
|---|---|
| Issue ID | BDG-005 |
| Summary | Today sharing is text plus link through the share sheet; there is no image and no expiry anywhere in the schema, so a "valid for three days" claim would be false without new server state. |
| Severity | P3 (idea) |
| Reproducibility | n/a |
| Platform | all |
| Affected components | `InviteView.tsx:19-33` (`shareOrCopy`), `:67-78` (`copy`, `share`), `src/app/i/[code]/route.ts`, `src/components/features/invite/inviteCode.ts` |
| Backend dependencies | `referral_codes`, `referral_redeem` (`0332/0333`), `referral_my_summary` (`0308`) |
| Root cause | n/a (feature gap). Facts: `shareOrCopy(text, url)` calls `navigator.share({text, url})`, else `navigator.clipboard.writeText` (`InviteView.tsx:20-33`); text is `c.shareText(link)` = "Join me on buddget and get 37 days of Pro, no card needed. {link}". No `@capacitor/share` and no image generation for invites. Precedent for client-side image generation: `src/lib/loyalty/founderCardImage.ts` draws the founder card on a `<canvas>` with no dependency and the Founders page shares it (`settings/founders/page.tsx`), so an invite image can reuse that method. |
| Evidence | Expiry in the schema today: none. `referral_codes` columns are `user_id, code, created_at, invited_count, activated_count, rewards_count, owner_net` (`0308`, `0332`); `referral_redeem` never checks code age; the `/i/` cookie lasts 30 days (`route.ts:5`) but that is browser storage, not a rule. The only time limits are about the FRIEND: account at most 7 days old at redeem (`account_too_old`), 14-day activation window, 30-day native window, 30-day clawback. |
| Shared causes | BDG-004 (name/code on the artwork), BDG-006 (copy truthfulness). |
| Proposed solution | See below. |
| Regression risk | A hard expiry on the permanent code would break already-shared links and every code typed from memory. Keep the personal code permanent. |
| Test that proves it | Migration/API test: redeem a share token at t+3d-1s ok, at t+3d+1s `expired`; plus a copy test that no "expires" text appears unless a server `expires_at` exists. |
| Confidence | High on current behaviour. |
| Missing evidence | Whether the owner wants "three days" to bind the link or only the friend's sign-up window. |

### What a real three-day expiry needs (minimum)
1. New table, not a column on `referral_codes` (the code must stay permanent): `referral_shares(token text pk, inviter_id, expires_at timestamptz not null default now()+interval '3 days', created_at)` with RLS none for anon, service role only; an index on `expires_at` for the purge, plus retention (delete rows older than a few days in the existing daily job, per the DB-load rules).
2. A create call at share time (authenticated RPC or route) returning a short token; the shared link becomes `https://buddget.app/i/<token>` or `/i/<code>?s=<token>`.
3. Redeem: `referral_redeem` gains a branch: if a token is supplied, require `expires_at > now()` else return a new status `link_expired`; the personal code path stays as is. New `RedeemStatus` value in `referralsApi.ts:31-32`, a message for it, and `isFinalRedeem` already treats unknown statuses as final.
4. `/i/` route: today it does no DB call (deliberately, `route.ts:8-9`). Showing "expires in N days" or an "expired" state requires a lookup (cache or a cheap indexed read by token); otherwise state it only on the image and in redeem, not on the page. This also forces a real landing page (none exists today) for an expired state.
5. The image shows an expiry date only if it is the server's `expires_at`. No countdown, no fake urgency.
6. Wording: "No credit card required to start your trial." belongs on the landing page or trial info, per the register; the artwork carries headline, From, short code and the week line.

### Council arguments (four voices)
- **Pro (growth)**: a dated share creates a reason to act now and makes a screenshot of an old invite meaningfully stale; a short window limits leaked-link farming and the 7-day account window already mirrors that rhythm.
- **Against (trust and fairness)**: a friend opening a link on day 4 sees nothing happens, and the economics are unchanged for the inviter, so the expiry only blocks goodwill; invitation windows in this market follow chat apps where links sit for days. It adds a landing page, a table, cleanup, an expired state and EN/AR copy for a small gain.
- **Security**: the anti-abuse controls are on the friend side (mailbox, device, native gate, caps); link expiry adds little against abuse, but a short-lived token reduces the value of a leaked/scraped link and allows revocation. It must not replace the checks above.
- **Engineering (DB load)**: cheap if redeem looks up a token by primary key and a daily job purges; no hot-path scan. A per-share token must not be issued on every share tap without a cap (bound the number per inviter per day).
- **Can a per-share expiring link coexist with a permanent personal code? Yes**, cleanly: the personal code stays on the card, in Settings and typed at sign-up (never expires); each Share creates an optional dated token that resolves to the same inviter. Only the token carries `expires_at`. Without a token the old `/i/<code>` link keeps working, so existing shared links do not break. Recommendation to Council (suggestion only): ship the image without an expiry first (it needs no backend), decide the expiry afterwards on data.

---

## BDG-007 Rewards streak indicator at zero weeks highlights the last cell

| Field | Content |
|---|---|
| Issue ID | BDG-007 |
| Summary | There is no week-count-to-position maths: the strip is 12 calendar-week cells and the rightmost cell is always drawn as "this week" with a ring and glow, so at 0 weeks the only highlighted cell is the last one. |
| Severity | P3 |
| Reproducibility | Consistent. Open `/settings/rewards` on an account with no kept week. |
| Platform | all (in RTL the "last" cell is at the visual left, see below) |
| Affected components | `HotStreakCard.tsx:11-25,86-97`, `rewardsState.ts:25-30`, `membership.module.css:100-105`, `RewardsView.tsx:103-111`, server state `0309_pro_rewards_admin_state.sql:63-71` |
| Backend dependencies | `loyalty_state` weeks array (`0309:63-71`, exactly 12 entries) |
| Root cause | Confirmed. `stripWeeks` maps by array index, not by streak count: `weeks.map((w, i) => (i === weeks.length - 1 ? (kept ? 'current' : frozen ? 'frozen' : 'pending') : LOOK[w.state]))` (`rewardsState.ts:29`). The last cell is this week (server: `'open'` when `g.w = v_this`, `0309:66`), so any non-kept this-week becomes `pending`, and `streakCellLook('pending')` returns `now: true` (`HotStreakCard.tsx:24`), which applies `.wkNow` (36px high, 1.5px gilt ring, ember glow, `membership.module.css:105`). At streak 0 every other cell is `missed`/`before` (plain), so the lone ringed last cell reads as "the highlighted digit". There is no modulo and no index -1; the highlight is hard-wired to "the newest cell".
| Evidence | Quotes above. `streakCells` pads a short history with `'missed'` at the START so the newest stays last (`HotStreakCard.tsx:13-16`; test `membershipComponents.test.tsx:174`). Tests pin the behaviour: `rewardsState.test.ts:43-45` (`open` last -> `pending`). |
| Shared causes | none found. RTL: `.wk` is a `display:grid` of 12 columns with no `dir="ltr"` (compare `SegmentStrip.tsx:15` which sets it), so in Arabic the newest cell lands at the visual left. |
| Proposed solution | Pick the intended meaning first (owner decision below). If the strip is a calendar timeline (current design), at 0 draw this-week as a plain empty cell and ring it only when it can still be kept AND the streak is above 0, or drop the ring when `streak.current === 0`; the function change is one line in `stripWeeks` (return `'missed'` instead of `'pending'` when no week in the strip is kept/frozen) with the ring kept for `streak.current > 0`. If the owner wants a progress meter (position = week count, start state at 0), that is a different component: a count-driven strip where position `n` lights cells `1..n` and 0 lights none. |
| Behaviour today at 0, 1, 9, 10, 11, 20 | The strip shows the last 12 calendar weeks as the server sends them (always exactly 12 cells), so the count does not move the highlight. 0: 11 plain cells, last ringed (`pending`). 1: previous 11 plain, last lit and ringed (`current`) if this week is kept, else last ringed `pending` with the kept week next to it. 9, 10, 11: that many consecutive lit cells ending at the last (or at the one before it while this week is still open), last still ringed. 12 and above (20): all 12 lit; older weeks fall off the start (`tail = weeks.slice(-length)`); the number only appears in the title ("20-week streak") and `streakPoints`. Nothing wraps (no modulo), so 10 and 11 do not behave differently from 9. |
| Regression risk | Low; `stripWeeks`/`streakCellLook` are pure. The "this week still open" ring is a deliberate design element (mockup), so removing it at zero is a design call. |
| Test that proves it | Unit in `rewardsState.test.ts`: a strip of all `before/missed/open` weeks gives no `pending`/`now` cell (fails today, `:44` expects `pending`), and cases for counts 1, 9, 10, 11, 12, 20 plus an RTL render check of cell order. |
| Confidence | High that the highlight is "newest cell", medium on what the owner wants (they wrote "last digit" and "starting at zero", which suggests a counter-like expectation; the component draws cells, not digits). |
| Missing evidence | A screenshot of the owner's screen. |

---

## Queries for the lead
Counts and ids only, run one at a time, with limits.
1. `select value from public.platform_settings where key in ('referrals','trial_limits') limit 5;`
2. `select key, trial_days from public.plans where key = 'plus_trial';`
3. `select count(*) from public.referral_codes;` and `select count(*) from public.referrals;` (0332 said 0 rows on 2026-11-19; confirm whether real invites exist before changing code format or copy).
4. `select length(code) l, count(*) from public.referral_codes group by 1 order by 1 limit 20;`
5. Confirm 0332/0333 are applied: `select proname from pg_proc where proname in ('referral_redeem','referral_reward') limit 5;` and the signature `referral_redeem(uuid,text,text,text,text,text)`.

## Decisions that need the owner
1. BDG-007: is the strip a calendar timeline (keep the "this week" ring, but not at zero) or a progress meter by week count (position = count, start at 0)?
2. BDG-004: "much shorter sample code": only the sample/artwork text, or the real code format (needs a migration and keeps old codes working)?
3. BDG-005: should the image be built before any expiry exists (no expiry text on it), and should "no credit card" sit on the landing page (which does not exist yet)?
4. BDG-004: is "From {first name}" acceptable on a shared image given it is the inviter's real first name already visible in the code prefix?
5. BDG-006: the card says "37 days" unconditionally; accept adding a small "for new accounts" qualifier, or leave it as marketing copy?

## Decisions that need Council
1. BDG-005: three-day expiring share token, coexisting with the permanent personal code (arguments above). Needs four voices: growth, trust, security, DB load.
2. BDG-003: confirm the fix approach (JS-driven face visibility at 90 degrees) is acceptable for all four cards, since a Safari/WKWebView device check is required to prove it.
3. Invite copy honesty: whether held rows (`awaiting_native`, `review`) should be named in the friends list instead of "On its way".
