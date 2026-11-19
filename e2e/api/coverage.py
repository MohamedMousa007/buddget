# QA Session 06: builds the route-by-route coverage table for QA_API_DB_REPORT.md from src/app/api/**/route.ts.
# Usage: python -I e2e/api/coverage.py > out.md
import collections, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")

ST = {  # route: (result, note)
    'account/delete': ('Passed', 'no/garbage/tampered/forged token → 401; deleted synthetic C end to end (200 in 13.9 s), repeat → 401'),
    'ai': ('Failed', 'auth matrix pass; JSON `null` → 500 (API-001); 2 MB → 413; GET is public `{enabled,model}`'),
    'analytics/onboarding': ('Failed', 'JSON `null` → 500 with empty body (API-001); deleted-user JWT → 200 ok, write dropped (API-003)'),
    'app-config': ('Passed', 'public 200'),
    'auth/check-email': ('Failed', '`{"email":7}` → 500 (API-001); 35 hits in one minute passed a 30/min limit (DB-001)'),
    'auth/device/check': ('Passed', 'body ignored by design; 401 matrix'),
    'auth/device/trust': ('Passed', 'password-only session → 403 Verification required'),
    'auth/email-hook': ('Partial', '503 Not configured locally; HMAC verified by code in QA_SECURITY_REPORT'),
    'auth/password-updated': ('Passed', 'public 200 `{pending:false}`'),
    'auth/password/change': ('Passed', '400 on every bad body, 401 matrix'),
    'auth/second-factor': ('Passed', '403 without an OTP `amr`'),
    'auth/two-factor': ('Passed', '400 on bad bodies'),
    'auth/welcome': ('Partial', '401 matrix only; valid call skipped (would send a welcome email)'),
    'billing/paywall-view': ('Failed', 'JSON `null` → 500 (API-001); no rate limit, garbage bodies recorded (API-002)'),
    'billing/revenuecat': ('Partial', '503 not_configured locally; HMAC by code (SEC); nothing sent to RevenueCat'),
    'biometric/register': ('Passed', '400 on bad bodies'),
    'biometric/signin': ('Failed', 'per-device limit keyed on a fresh random id when the header is absent (API-004)'),
    'buddgy/turn': ('Partial', 'validation only (400/413); no model call'),
    'buddgy/usage': ('Passed', '200; deleted-user JWT → 401 (active-account check)'),
    'budget/ai': ('Failed', 'JSON `null` → 500 (API-001); 2 MB → 413; no model call'),
    'cron/data-retention': ('Passed', 'auth probe: 401 without secret and with a user JWT'),
    'cron/integrations': ('Passed', 'auth probe 401; prod outbox not draining (API-007, suspected)'),
    'cron/ios-crashes': ('Passed', 'auth probe 401'), 'cron/loyalty': ('Passed', 'auth probe 401'),
    'cron/month-carry': ('Passed', 'auth probe 401; code: paginated reads, 50 s time budget'),
    'cron/notifications': ('Passed', 'auth probe 401; pg_cron `notifications_tick` → pg_net 200s'),
    'cron/prices': ('Passed', 'auth probe 401'), 'cron/sms-canary': ('Passed', 'auth probe 401'), 'cron/sms-harvest': ('Passed', 'auth probe 401'),
    'devices': ('Failed', 'A claiming B device id makes an A-scoped row only; deleted-user JWT → 200, write dropped (API-003)'),
    'devices/[id]': ('Passed', "B's device → 404; not-a-uuid → 400/404"),
    'entitlements/me': ('Failed', 'deleted-user JWT → 200 Free/active (API-003)'),
    'entitlements/trial': ('Passed', '12 parallel claims → 1 granted, 11 already_claimed'),
    'feedback': ('Partial', '503 locally (no LINEAR_API_KEY), 401 matrix'),
    'flags': ('Passed', '200'), 'gold': ('Passed', 'public 200, 1.8 s warm median'), 'health': ('Passed', '200'),
    'health/deep': ('Failed', 'public; reports cron secret, outbox and cache state (API-006)'),
    'notifications': ('Passed', "GET capped at 80; PATCH 201 ids → 400; B's id → B's row unchanged"),
    'prices/refresh': ('Not tested', 'skipped on purpose (would crawl upstream price providers); code: 1 h DB debounce'),
    'push/register': ('Passed', '400 on bad bodies'),
    'push/send': ('Partial', 'validation only (400/413); no FCM call; self-only by code'),
    'rates': ('Passed', 'public 200; junk query ignored'),
    'receipt/scan': ('Partial', 'validation only (400/413); no model call'),
    'savings/carry': ('Passed', 'bad monthKey 400, out-of-range months 404'),
    'site/event': ('Partial', 'validation only (400)'),
    'site/lead': ('Partial', 'validation only (400); no valid lead sent'),
    'sms/ack': ('Partial', 'validation only (400)'), 'sms/confirm': ('Passed', 'random id 404, non-uuid 400'),
    'sms/dismiss': ('Passed', 'random id 404'), 'sms/flag-action': ('Partial', 'validation only (400)'),
    'sms/health': ('Passed', '401 without auth'), 'sms/own-transfer': ('Partial', 'validation only (400)'),
    'sms/parse': ('Failed', 'invalid body → 200 `{ok:false}` (API-005); 2 MB → 413; booking is QA_SMS_REPORT scope'),
    'sms/revoke-token': ('Partial', '401 matrix only'),
    'sms/setup-token': ('Passed', '10 parallel issues → active-token cap holds'),
    'sms/undo': ('Partial', 'validation only (400)'),
    'support/board': ('Passed', '200'), 'support/board/[number]/vote': ('Partial', 'validation only; no vote on real tickets'),
    'support/submit': ('Partial', 'validation only; no ticket created (Linear outbox)'),
    'support/tickets': ('Passed', '200'), 'support/tickets/[number]': ('Passed', 'abc / -1 / 20-digit → 404'),
    'voice/transcribe': ('Partial', 'validation only (400); no model call'),
    'webhooks/linear': ('Partial', '503 Not configured locally'), 'webhooks/resend': ('Partial', '503 Not configured locally'),
    'webhooks/sentry': ('Partial', '503 Not configured locally'),
}
PAGED = {'admin/audit', 'admin/sms/logs', 'admin/users'}
rows = []
for d, _, fs in os.walk('src/app/api'):
    if 'route.ts' not in fs:
        continue
    r = d.replace('\\', '/')[len('src/app/api/'):]
    src = open(os.path.join(d, 'route.ts'), encoding='utf8').read()
    methods = ','.join(sorted(set(re.findall(r'export (?:async function|const) (GET|POST|PUT|PATCH|DELETE)\b', src))))
    if r == 'admin/leads':
        s = ('Failed', 'code review: offset pagination on non-unique `created_at` (API-008)')
    elif r.startswith('admin/'):
        s = ('Not tested', 'runtime: no synthetic staff account; guardAdmin per QA_SECURITY_REPORT' + ('; cursor/limit pagination reviewed, OK' if r in PAGED else ''))
    else:
        s = ST.get(r, ('?', '?'))
    rows.append((r, methods, *s))
rows.sort()
c = collections.Counter(r[2] for r in rows)
print(f'Routes: {len(rows)} · ' + ' · '.join(f'{k} {v}' for k, v in sorted(c.items())))
print()
print('| Route | Methods | Result | Notes |\n|---|---|---|---|')
for r in rows:
    print(f'| `/api/{r[0]}` | {r[1]} | {r[2]} | {r[3]} |')
