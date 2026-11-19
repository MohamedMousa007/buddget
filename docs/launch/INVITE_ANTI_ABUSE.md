# Invite a friend: anti-abuse design (S8G-05, S8G-06)

Owner decision, 2026-11-19: invite anti-abuse goes to an industry-standard, secure level. This file is the design. Migration 0330, `POST /api/referrals/redeem` and `src/lib/referrals/` build it. The rules users see are unchanged: friend +7 trial days, inviter one Pro week or 500 Sparks, 4 per month and 12 per year.

## Threats

| Threat | Before | Now |
|---|---|---|
| One person, many emails, on the web (S8G-05) | Every account rewarded: no device id, so no device check | No inviter reward until the friend signs in on a native device; one reward per native device |
| Same mailbox re-joins after deleting the account (S8G-06) | Counted again | A mailbox is invited once, ever: a keyed mailbox hash on `referrals` survives deletion |
| Gmail aliases (`a.b+x@gmail.com`) | Separate people | Same normalisation as the trial (`normalizeEmailKey`): one person |
| Throwaway mailboxes | Accepted | Disposable domains refused (`disposable_email`) |
| Unverified sign-ups | Could redeem | Redeem needs a confirmed email (`unverified`), like the trial |
| Code guessing, scripted redeems | No limit | 20 redeems per user per 10 min, 300 per network per hour (429, the app retries later) |
| Inviter's own second phone or account | Rejected only when the device id matched | Rejected when any of the friend's devices is one of the inviter's (`self_device`) |
| Inviter farms from one place (same Wi-Fi, same flat) | Not seen | A third friend of one inviter from the same network within 30 days (0331; two on one carrier range or campus Wi-Fi are normal), or a friend on the inviter's own network, is held for manual review |
| Parallel double taps (S8G-14) and parallel checks (S8G-13) | 409s; double payment | Per-user lock, `unique_violation` answered as `already_redeemed`; evaluation locks rows `FOR UPDATE SKIP LOCKED` and re-checks status |

## Rules, in the order they run

### At redeem (`POST /api/referrals/redeem`, service-only RPC `referral_redeem(p_user, ...)`)

The route checks, in order:
1. The caller has a live session (S8C-02).
2. The rate limits: per user, then per network.
3. The email is confirmed.
4. The email is not from a disposable domain.

Then it calls the database with the mailbox key and the network key. The mailbox key is built exactly as `/api/entitlements/trial` builds it, so it matches `trial_claims`.

The RPC takes a per-user advisory lock, then refuses with one of these statuses:
- `invalid_code`
- `self_invite`: the inviter's own account, or the inviter's device
- `account_too_old`
- `already_redeemed`: this account, or this mailbox, already has a referral row of any status, ever
- `device_used`: a rejected row is kept

A clean redeem stores `invitee_mailbox` and `invitee_net`. It also notes review signals (see below) on the row; they do not block the redeem.

### At reward (`referral_reward`, called by the evaluation)

1. **Native gate.** The friend must have a native device (`user_devices`, platform `ios` or `android`, not revoked).
   - Without one, the row stays `activated` with reason `awaiting_native`.
   - Every evaluation (the friend's app open, the nightly job) retries it. When the friend signs in on a phone, the next check pays.
   - Still waiting 30 days after sign-up: the row becomes `expired`, reason `no_native_device`.
2. **Device.**
   - Any of the friend's devices is one of the inviter's: `rejected`, reason `self_device`.
   - Any of the friend's devices belongs to another account that brought a reward, or has one in flight (`activated`, `rewarded`, `capped`): `rejected`, reason `device_used`.
3. **Review.** A row with review signals stays `activated` with reason `review`. Staff release it with the existing "approve" tool (`admin_rewards_referral_approve`, which forces) or revoke it.
4. **Caps.** 4 per calendar month, 12 per year (unchanged).

No new `status` values: the Invite page reads `status`, and a held friend shows as "activated" (done their part, reward on its way).

## Signals and privacy

- **Mailbox key.** The trial's key: an HMAC with `TRIAL_CLAIM_KEY_SECRET`, else SHA-256 in the database. Never the address itself.
- **Network key.** IPv4 `/24` or IPv6 `/48` of the caller's address. The address comes from `clientIp` (`x-real-ip`, set by Vercel). The key is an HMAC with a random pepper that lives only in the database (`private.referral_pepper`), so it cannot be reversed by brute force from a dump of `referrals`.
  - The inviter's network is stamped on `referral_codes.owner_net` when they open the Invite page, from the PostgREST request (`cf-connecting-ip`, set by the Cloudflare edge). It is written only when it changes.
- **Retention.** The nightly evaluation nulls `invitee_net` after 90 days. The mailbox key stays: it is what makes "invited once, ever" hold.

## Why network is only a review signal

Egyptian mobile carriers use carrier-grade NAT, so thousands of real people share one address, and a household shares one Wi-Fi. Refusing on network would refuse real friends. The strong gates are the native device and the mailbox. The network feeds manual review and the coarse rate limit only.

## Residual risk (accepted)

- Device ids are chosen by the client (`/api/devices`). A scripted client can invent a "native" device id per account. App Attest and Play Integrity would close this; they are out of scope before launch. What bounds the cost: the caps (4 a month, 12 a year, at most one Pro week each), the 3-day and 5-record activation, the review signals, and the 30-day clawback.
- Shipped native builds before this change call the old RPC directly. It is gone, so they get `error` and keep the code until they update. Native apps on Frankfurt need a rebuild anyway.

## Tests

`e2e/api/round2/pro-rewards/40-referrals.spec.ts`:
- F7: web friends are held (`awaiting_native`) until a native device appears; one device, two accounts, one reward.
- F13: the same mailbox after deleting the account gets `already_redeemed`.
- F4b: parallel redeems all answer 200.
- F8b: parallel evaluations pay once.
- F15: network review signals.
- F16: disposable and unverified emails.
- F17: rate limit.

Route unit tests are in `src/app/api/referrals/redeem/route.test.ts`.
