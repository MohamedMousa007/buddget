# Store screenshots (web capture, light theme)

Captured from `main` (f16d0e1) in a cloud session with `e2e/ui/store-shots.mjs`, against `next dev -p 3100 --webpack`
(`NEXT_PUBLIC_DEV_AUTH_BYPASS=0`, empty `NEXT_PUBLIC_API_BASE_URL`, `TZ=Africa/Cairo`). One synthetic user
(`qa-e2e-shots-*`) signed in for real, seeded through the service-role REST with the persona **Layla Hassan**. It was deleted
at the end, and the count of `qa-e2e-*` users left was 0. Plain screenshots: no captions, no overlays, no edits after capture.
Chromium with `reducedMotion: 'reduce'`, after `document.fonts.ready` and `html[lang]`, with the Next dev overlay and toasts hidden.

These are web renders of the current UI. STORE_SETUP.md says the final store images come from the Simulator and emulator on the
store build. Use these until those exist.

| Folder | Pixels | Viewport x scale | Shots |
|---|---|---|---|
| `iphone-6.9/` | 1320 x 2868 | 440 x 956 @3 | 01 to 07 |
| `ipad-13/` | 2064 x 2752 | 1032 x 1376 @2 | 01, 03, 04, 05, 07 |
| `play-phone/` | 1080 x 1920 | 360 x 640 @3 | 01 to 07 |
| `play-7in/` | 1200 x 1920 | 600 x 960 @2 | 01, 03, 04, 07 |
| `play-10in/` | 1600 x 2560 | 800 x 1280 @2 | 01, 03, 04, 07 |

## What each shot shows

1. **01-today**: Flow, which is now the home screen. Hero: "Left to spend" 7,809 of 26,350 EGP, 781/day until
   Nov 30, "On track", money in +35,500, money out -18,541, then today's rows. On iPad and the 10" tablet the category
   budget chips sit beside the list.
2. **02-sms-tracking**: Settings, scrolled to "Tracking & Buddgy", with the **SMS tracking** switch **off** ("Log bank texts as
   expenses automatically"). On the web, `/settings/sms` sends you to this row on the Settings page. The iPhone Shortcut guide
   page exists only in the native iOS app.
3. **03-flow-sms**: Flow, scrolled to Nov 19, where an Instapay credit was recorded from a bank SMS: "Instapay from Studio Nile
   +3,500, From SMS · Set account". The Nov 19 day also has SMS-sourced card expenses (Dokki Fresh Market, CairoRide).
4. **04-installments**: Debts, Installments tab. "Phone on installments" with Sahla Pay: 12 x 1,250, interest-free, 5 of 12 paid,
   8,750 outstanding, next cycle Nov 28. Hero: 12,750 still owed (the plan plus a 4,000 personal debt), next payment 1,250.
   On iPad the "Recent moves" list shows the paid Jun to Oct installments.
5. **05-home-arabic**: The same home screen in Arabic. The app keeps the English (left-to-right) order in Arabic for launch (QA-27).
6. **06-buddgy-chat**: Buddgy chat with a real, live answer. Question: "How much can I still spend on eating out this month?"
   Each device asked it live, so the wording differs: for example "You have 770 EGP left to spend on Food this month, and another
   430 EGP left in Enjoyment." (Checked: Budget). 770 = 2,000 Food budget minus 1,230 spent, which matches the seed.
7. **07-pro-trial**: Settings > Plan and billing in the trial state: the PRO TRIAL card for Layla Hassan, "30-day trial · No card
   on file", trial ends 21 Dec 2026, "Day 1 of 30", then the Keep Pro plan choice.

## Persona data (all invented)

- EGP, Cairo. Salary 32,000 on the 1st (a monthly payday). Freelance Instapay 3,500 on the 19th.
- 26 expenses this month at invented merchants (Nour Grocers, Fayrouz Café, El Bostan Koshary, CairoRide, Sama Pharmacy, Bazar
  Line, Mazaya Home, and others), 16 of them linked to SMS records. Rent 8,500.
- Accounts: CIB bank (•• 4821) with a CIB Visa debit card (•• 7302), Vodafone Cash wallet, cash.
- A budget plan with one row per category, totalling 26,350. Goal: Emergency fund, 18,500 of 60,000.
- BNPL: phone, Sahla Pay, 12 x 1,250, 5 paid. Debt: 4,000 borrowed from Omar, due Dec 15.
- The Pro trial was started by the app's own claim at first sign-in, so the screen shows a fresh trial (day 1 of 30).

## Things that looked wrong or need a decision

- **Shot 3 has no SMS chip on expense rows.** Flow marks a row "From SMS" only on an income row that still needs an action
  ("Set account" or "Link to a payday"). An expense that came from an SMS looks the same as one typed by hand. To show an SMS
  row at all, the Instapay credit was seeded with no account, so the row reads "From SMS · Set account". The caption "Every bank
  text, sorted without typing" fits loosely. A source chip on SMS rows would make this shot clearer. That needs an app change,
  which was out of scope.
- **Shot 2 has no "works without SMS" line.** The shot list asks for it, but the web Settings page has only the switch and
  "Log bank texts as expenses automatically".
- **Shot 7 shows a crossed-out price.** The Yearly option shows "EGP 839.88" struck through next to "EGP 499.99", with a
  "BEST VALUE · SAVE 40%" tag. STORE_SETUP.md (paywall copy) says "no crossed-out price". Check this before review.
- **Buddgy's orb covers some content.** The draggable Buddgy face sits on the left edge on every screen. The script parks it
  low, just above the tab bar, the way a user could drag it. It still covers part of one row's category icon on phones.
- **Buddgy composer spinner.** In shot 6 the small wheel next to the composer was still spinning at capture time. It looks like
  a loading state.
- **Budget rows must be named after categories.** A budget row first named "Rent & bills" (holding Rent and Utilities) was not
  matched to any spending, and the Flow hero showed "Over pace". A row named "Bills" holding Utilities left the Rent chip at
  105%, because Rent absorbed the Utilities spending. With one row per category key, everything adds up. This may be worth a
  look in the budget-to-category matching.
- The account email is never in frame. Shot 2 is scrolled below the profile card, which shows the synthetic address.
- `e2e/README.md` should list this script. The brief limited this commit to the shots, the script and this file, so that line is
  not added yet: `| ui/store-shots.mjs | Store screenshots, Layla Hassan persona, 5 device classes | TZ=Africa/Cairo node e2e/ui/store-shots.mjs |`.

## Re-run

```bash
TZ=Africa/Cairo NEXT_PUBLIC_DEV_AUTH_BYPASS=0 NEXT_PUBLIC_API_BASE_URL= npx next dev -p 3100 --webpack
```

```bash
TZ=Africa/Cairo node e2e/ui/store-shots.mjs
```

Options: `DEVICES=iphone-6.9,ipad-13`, `SHOTS=1,3`, `OUT=<folder>`, `NO_AI=1` (type the question, do not send it), and
`KEEP_USER=1` (keep the user; delete it by hand afterwards). The run needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`
in the environment or `.env.local`. The report goes to `e2e/ui/out/store-shots.json`.
