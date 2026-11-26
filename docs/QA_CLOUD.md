# Cloud QA recipe

A cloud session gets a short brief ("follow `docs/QA_CLOUD.md`, check X") and nothing else. Everything it needs to start is here, so it spends no tokens working out setup.

## Launching one (for the session that starts it)
1. The cloud session clones this session's branch. A branch that exists only locally fails with "requested branch or commit was not found". Before `start_session` with `target: "cloud"`, run `git push origin HEAD` (or work on `main`).
2. Brief = one line of goal, the paths to check, "read-only, push nothing", and a pointer to this file. Do not retype setup steps.
3. The environment's setup script should be `npm ci` (Environment settings, "Add a setup script"), so dependencies are ready before the session starts.

## Run the app (dev auth bypass, signed-in stand-in, no Supabase)
```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= SUPABASE_SECRET_KEY= NEXT_PUBLIC_API_BASE_URL= NEXT_PUBLIC_DEV_AUTH_BYPASS=1 npm run dev -- -p 3001
```
Blank every Supabase variable, the secret key too, and the API base: a cloud environment sets them, and with them set the bypass talks to the live project (or sends `/api` calls to the native host). The first page compile is slow; wait for it before screenshots. Use a mobile viewport (375x667, 375x812) and 1440.

## Seed state from the browser console
```js
__qa.plan('free' | 'active' | 'trial' | 'trialEnding' | 'issue' | 'ended', { founder: 7 })  // billing state; founder optional
__qa.lang('ar' | 'en'); __qa.theme('dark' | 'light' | 'system'); __qa.name('Mohamed Ahmed Abdel Rahman El Sayed')
localStorage.qa_staff = '1'  // then reload: the admin staff strip
```
`__finance`, `__settings`, `__billing` are the raw stores. The dashboard and reports render zeros in this mode; Settings, Flow and the profile menu are fine.

## Rules
Screenshots under `docs/design/<area>/qa/`, not committed. Report defects as: file, what is wrong, what the design shows. Fix nothing unless the brief says so.
