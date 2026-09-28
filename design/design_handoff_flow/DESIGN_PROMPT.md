# Design Brief — Buddget "Flow" + "Paydays"

> Supersedes the first version of this file. Decisions here are grounded in an audit of Buddget's
> own data model and a review of 11 comparable products (Monarch, Copilot, Lunch Money, YNAB,
> Actual, Emma, Rocket Money, Simplifi, PocketGuard, Wallet, Cashew). The rationale is kept in the
> brief on purpose — do not silently reverse a decision without reading why it was made.

**Build with the Buddget design system** (project `3e84a07a-da79-472d-b487-07c93afa5f48`), re-synced
2026-09-28 with the new **teal** identity. It holds
46 real components with real prop contracts. Use them — do not hand-roll a transaction row, a
month picker, a sheet or a payday timeline that already exists.

---

## 1. What we are doing

Buddget is collapsing from many tabs to few. Step one merges **Expenses** and **Income** into one
tab, **Flow**. This brief covers Flow *and* the surface that income setup moves to.

Bottom nav becomes: Home · **Flow** · FAB(+) · Debts · More.
Flow's icon: a banknote carrying both an incoming and an outgoing arrow. Draw it as a 24px,
1.75px-stroke glyph in the lucide idiom; deliver the SVG. Fallback: `BanknoteArrowUp`.

**The Arabic label for Flow is `المعاملات`, NOT `تدفق`.** This is deliberate. A literal translation
of "Flow" reads technical and literary in Arabic; `المعاملات` is the ordinary word for financial
transactions/dealings, it is plural-definite like every other nav label (`المصروفات`, `الديون`), and
it stays clearly distinct from `أيام القبض` (Paydays). Buddget already localises non-literally —
`Dashboard → الرئيسية` — so this follows existing precedent rather than breaking it.

---

## 2. The core split (decided — design to this)

**Flow is the ledger. Paydays is the setup.**

| | **Flow** (tab) | **Paydays** (one tap from Flow) |
|---|---|---|
| Holds | What actually happened, and this period's movement | The income streams the user has declared |
| Objects | `IncomeEvent` + `Expense` rows | `IncomeSource` recurring templates |
| Question it answers | "Where did my money go, and what came in?" | "What am I expecting, and did it arrive?" |
| Changes | Constantly | Rarely — this is configuration |

Why not one page: every product that models expected income separates setup from the ledger
(Monarch "Recurring", Lunch Money "Recurring", Simplifi "Bills & Income", Actual "Schedules"). The
only products that don't are the ones that refuse to model expected income at all (YNAB, Copilot) —
a position Buddget has already ruled out by building `paydayDays[]`, `occurrence_date` and drift
detection.

Why not in Settings: **nobody does this**, and burying it there is how Rocket Money ended up with
income scattered across three screens. Keep one obvious door.

### Space, concretely
At 390×844, Flow's fixed chrome costs roughly: safe-area + header 60, month pager 44, hero 150,
segment 40, filter chips 40, bottom nav 64 + 34 inset ≈ **432px**, leaving ~410px of ledger —
about 5–6 rows. The current Income tab's recurring carousel is ~190px. **Putting it in Flow would
cost half the visible ledger.** That is the quantitative answer to "do we have space": no.

---

## 3. Naming (decided)

The setup surface is called **Paydays**.

- Not **Accounts** — universally means bank connections and balances (Monarch: "Accounts show where
  your money lives"). Reserve it.
- Not **Cash Flow** — universally a *report*, never a setup screen.
- Not **Income** — reads as a filter on a report ("show me my income"), not a managed list.
- Not **Recurring** — correct only if bills live there too; ours is income-only, so users would
  arrive expecting subscriptions.
- Not **Streams / Inflows / Currents** — in English they blur into "Flow", and in Arabic they all
  land on the same تدفق/تدفقات family. The app is fully bilingual; the two labels must stay distinct
  in both. (Flow itself ships as `المعاملات` in Arabic, not a literal translation — see §1.)

**Paydays** wins because it is the only candidate that is simultaneously distinctive, instantly
concrete, free of the above collisions, and already true to the data model — the whole engine is
built on paydays, drift and occurrences. Arabic: **أيام القبض**, which is colloquial, clear, and
unmistakably different from `المعاملات`.

Fallback if the team judges "Paydays" too salary-leaning for rental or dividend income:
**Income streams**. Do not use "Sources" alone — it prompts "sources of what?".

---

## 4. Flow — what to design

### 4.1 One hero, two directions
Replace two hero cards with one that reads at a glance: money **in**, money **out**, and **net**
for the period. Net is the headline; in/out are the supporting pair. Give it a **compact scrolled
state** that collapses to a slim sticky bar (net + in/out) so the ledger gets the screen back.

Do NOT merge at the summary level beyond this — no product merges income and spending into one
aggregate, because they aren't comparable quantities.

### 4.2 Direction segment
**All · In · Out**, re-scoping hero, filters and ledger. `All` is the default and must feel like
the primary view, not a compromise. State how the hero number changes per segment.

### 4.3 One merged ledger — and the frequency problem
Day-grouped, descending, full-bleed rows on a shared card surface with the hairline inset to 82px
(Buddget's signature row rhythm — keep it). Day headers carry a **net** subtotal.

**Income is 1–2 rows a month against hundreds of expense rows.** Every product that merges them
does it the same way: income is simply a green, signed row in the list — *nobody gives it its own
section*, because a section header over one row reads as a bug. Do not section the scroll by
direction. The segment is how users isolate income.

### 4.4 Distinguishing in from out without colour alone
Required redundancy: sign (`+` / `−`), amount colour (green / primary text), and the icon-chip
treatment (income types vs expense categories). Consider a left edge-marker. State contrast
ratios. A greyscale screenshot and a colour-blind user must both parse the ledger.

### 4.5 The payday signal — the one rule that matters
**Surface a payday in Flow only when it would change the number.**

Here is why this is the rule. Buddget's income total *assumes a payday arrived unless told
otherwise* (`calculations.ts:225` — with no events it adds `perOccurrence × paydayCount`). So when
a salary is genuinely late and nobody marks it, **the number on screen is lying.** That is the
moment the payday earns space, and the only one.

- Everything on time → **show nothing.** Zero pixels.
- A payday overdue past its grace window (`paydayDriftDays ?? 5`) → **one line** in the In segment:
  the stream, how late, and two actions — *Received* / *Missed*. This is the single highest-value
  micro-feature in this whole brief; PocketGuard's "past due dates will indicate that the income
  wasn't received" is the closest thing the market has, and Buddget derives lateness already.
- Never render a full timeline or carousel in Flow.

Follow Emma's documented scope cut — they removed past paydays and simultaneous paydays because
they "were deemed confusing when payday schedules vary". **Next payday only, one at a time.**

### 4.6 Unmatched income (this replaces "unallocated")
Buddget has no allocation concept and **should not grow one** — YNAB's "Ready to Assign" is a
structural commitment with a documented upkeep cost (30–60 min/month), and it is the reason people
churn to simpler apps. It is the wrong fit for a minimalist build.

What Buddget *does* have is **unmatched income**: a credit that arrived but isn't linked to a
scheduled payday. Today that produces a real bug in the user's mental model — the paycheck appears
twice, once as a stray row and once as an unfilled payday — and the only fix is an undiscoverable
right-swipe.

**This banner's job is to stop the double-count.** Left alone, one paycheck reads as two things —
a stray income row *and* an unfilled payday still showing as awaiting/late — and the stream's
"Received / % of expected / To come" under-reports for the rest of the month. The banner is the
only CTA that resolves that, so it has to be impossible to miss and trivial to act on. The
right-swipe stays as a power-user shortcut; it must stop being the *only* route.

Design a **conditional banner** in the In segment, shown only when there is an unlinked credit
*and* an unfilled payday it plausibly matches:

> **1,240 SAR arrived on Sep 25** — is this your Al Rajhi salary?
> [ Yes, link it ]   [ No, keep separate ]

Requirements:
- **Present only when there is something to resolve; gone the instant there is nothing.** Zero
  pixels in the calm state. This is YNAB's disappearing-banner mechanic, and it is why a banner
  like this doesn't read as clutter.
- **Both answers must be terminal.** "No, keep separate" is a real, remembered decision — the
  banner must not return for that pairing. A dismiss that silently re-appears next month is worse
  than no banner.
- **Name the specific candidate**, never a generic count. "1,240 SAR unassigned" makes the user do
  the matching; "is this your Al Rajhi salary?" does it for them. Buddget already has the matching
  logic (`matchSalary.ts`, ±15% confirm band, drift window) — the banner is just its UI.
- **Reject YNAB's zero-target obligation.** There is no running "unassigned" total to drive to
  zero, no red over-assigned state, no scoreboard. Follow Actual Budget's tone: a neutral question,
  never a scold.
- Multiple candidates → one banner at a time, most recent first. Never a stack.

### 4.7 Two-way entry (copy this from Lunch Money)
- Flow header → **Paydays** (always reachable, one tap).
- An income row in Flow → **"Make this recurring"**, creating a stream pre-filled from that row.

That second edge is what stops Paydays feeling like a place you have to remember to visit.

---

## 5. Paydays — what to design

A list of income streams. Per stream: type glyph + name, cadence (`Monthly · 25`, `Biweekly · 5 / 20`),
destination, expected-per-period, and a compact status.

**The full payday timeline lives here, on the stream's detail** — not in Flow, not in the list.
This is where the existing `PaydayTimeline` component belongs, with its whole action set intact
(see §7.4).

Design: the list, the stream detail with the timeline, add/edit a stream, reorder, and the empty
state. The empty state matters — it is the first thing a new user meets, and declaring a salary is
what unlocks every SMS automation downstream (see §6).

---

## 6. Payment methods stay where they are (decided)

Do **not** merge payment methods into Flow or Paydays.

- **No market precedent exists.** Every product resolves "payment methods" into either the accounts
  list (Monarch, Cashew, MoneyCoach, YNAB) or a per-transaction field (Wallet by BudgetBakers).
  Nobody ships it as a first-class peer screen, so a Payment Methods tab would be unfamiliar to
  every user arriving from another app.
- **They are a different kind of object.** A `PaymentMethod` in Buddget has *no balance field* —
  it is identity (`name`, `type`, `last4`, `isDefault`) plus a ~107-brand catalogue. Savings
  accounts and debts hold balances; payment methods do not. They cannot join an "accounts" list
  without inventing a balance concept.
- They are also *required* on expenses and *optional* on income, so they are not an income concept.

They keep their current home (profile menu + the quick-add tile). Flow and Paydays should *use*
them — as the destination chip on a stream and the subtitle on a row — and nothing more.

---

## 7. Must-keep checklist

Nothing here may be dropped or buried more than one tap deep.

1. Month pager + all five period presets, incl. custom From/To.
2. Category / payment-method / amount filters, now also filtering **direction** and **income type**.
3. Both hero number sets: spend + avg/day, and expected-vs-received + % + to-come.
4. **The payday action state machine, in full** (on the stream detail): untouched → *Missed* |
   *Received*; received → *Delete* | *Edit*; marked-missed-reversible → *Awaiting* | *Received*;
   marked-missed-long-past → *Received* only; not-yet-actionable → "settle the earlier payday first".
5. Add / edit / delete / reorder income **streams**, and edit/delete income **events**.
6. Link-to-payday (today's swipe-right "assign") and swipe-delete + undo, on both directions.
7. Every badge and status: declined, refunded, not-counted, returned, blocked, recurring, one-time,
   days-late, partial, missed.
8. Secondary-currency lines throughout.
9. **The SMS/AI layer must stay visible and reachable from Flow** — this is Buddget's advantage:
   the SMS review chip and sheet, pending-SMS cards, account/subscription detection banners,
   receipt scan, hold-the-FAB voice capture, AI chat.

### Recurring vs one-time — the clean split
- **Recurring income** is an `IncomeSource` → lives in **Paydays**, generates expected paydays.
- **One-time income** is an `IncomeEvent` with no `templateId` → it is **just a row in Flow**. It
  gets no setup surface at all. Created from the FAB.

This mirrors the data model exactly and removes a whole category of user confusion.

---

## 8. Known defects — FIX these in the redesign, do not inherit them

These are not "constraints to work around". They are existing defects, verified in the source, and
this redesign is the moment to correct them. **A design that reproduces any of these has failed
the brief.** Carry this section through to the implementation handoff.

### 8.0 The one that destroys user data — fix first
**Linking a credit to a payday overwrites the real `receivedDate` with the payday date**
(`AssignIncomeSheet.tsx:203` writes `{ templateId, receivedDate: date, occurrenceDate: date,
status: 'confirmed' }` — both dates set to the same value). Two consequences: the day the money *actually arrived* is gone forever,
and `eventDaysLate` — which derives drift from `receivedDate - occurrenceDate` — can never report
anything for that event again. So the act of tidying up your income silently destroys the very
signal the payday engine exists to measure.

The fix: **`occurrenceDate` records which payday this fulfils; `receivedDate` keeps the truth of
when it landed.** They are different facts and must stop being collapsed into one. The design must
then *show* the difference — a linked-but-late payday should read "arrived 3 days late", not
silently present as on-time.

### The rest

1. **Two legacy representations of one-time income** exist — an `IncomeEvent` with no `templateId`,
   and an older `IncomeSource` with `isRecurring: false`. Three separate code paths de-dupe them by
   shared id. Any "all income" list must not show both.
2. **"Assign" is already taken.** In this codebase it means *link a credit to a payday*, not
   *allocate money to a destination*. If the design introduces an allocation verb, it must be a
   different word or it collides with existing state and copy.
3. **SMS-created income never sets a payment method**, so those rows render as "Main account" —
   the UI asserts a destination the data never recorded. Design an honest treatment for
   "destination unknown", and a cheap way to set it after the fact.
4. `linkedSavingsAccountId` / `linkedDebtId` mean *where the money came from* (a savings withdrawal
   taken as income, or borrowed money) — **not** a destination. They are also documented on
   `IncomeSource` but only ever written on `IncomeEvent`, so the source-level fields are dead.
   Don't present any of them as destinations.
5. **The only route to linking a credit is an undiscoverable right-swipe.** That is why the double
   -count in §4.6 persists in real accounts. The banner is the fix; the swipe stays as a shortcut.

---

## 9. Design system — non-negotiable

The DS project was **re-synced on 2026-09-28 with a new teal identity** (Revamp Kit v1). If you have
seen an older Buddget design, everything about its colour is now wrong.

- **Tokens only.** No hex literals. Both **light and dark** must be delivered; dark is primary in
  practice and dark mode is **class-based** (`.dark`), not `prefers-color-scheme`.
- **Teal is the brand and every primary action. Red does exactly one job: destructive actions and
  over-budget alerts.** Red is never a CTA. Outflow amounts are plain text, not red — red is
  reserved so that when it appears, it means something.
  - `--color-brand-primary` — the brand fill, CTAs, active nav, FAB
  - `--color-brand-primary-ink` — teal **text** and links
  - `--color-brand-on-primary` — anything sitting **on** a teal fill
  - `--color-brand-primary-soft` — teal tint backgrounds and icon chips
  - ⚠️ **`--color-brand-primary` fails contrast as TEXT (2.71:1 on white).** Fills, borders and
    icons only. Use `-ink` for text. This one trips people up.
- Other semantics: `--color-brand-green` income/received · `--color-brand-red` destructive/over-budget
  · `--color-brand-amber` warning/late · `--color-brand-gold` investment. Each has a `-soft`
  counterpart for badge backgrounds.
- **Category ramp** `--color-cat-1…6` for charts and category chips; `--chart-1…5` mirrors it.
- **Surfaces are green-tinted neutrals, not grey**: `--color-brand-bg` · `-card` · `-elevated` ·
  `-sunken` · `-border` · `-border-strong`.
- **Elevation, not glass.** `--shadow-sm|md|lg`. The old glass-blur card identity is retired;
  `.glass-card` still exists but is no longer the default card look.
- **Radius:** buttons/inputs **12px** (`rounded-xl`), cards **16px** (`rounded-2xl`), sheet tops
  **24px** (`rounded-3xl`), chips `rounded-full`.
- Type: DM Sans; **every amount, date and percentage uses `font-mono-numbers`** (JetBrains Mono) and
  `tabular-nums`.
- **Every input/select/trigger is 48px tall. No tap target under 44×44px.**
- Safe areas via `env(safe-area-inset-*)`; the ledger scrolls under a 64px nav + inset without
  clipping the last row.
- **Arabic**: `dir` stays LTR, so use logical properties everywhere — `ms-/me-/ps-/pe-`,
  `text-start/text-end`. Never `ml-/pl-/text-left`. Labels wrap to two lines; reserve the space.

### Two absolute product rules
- 🚫 **Never a pig.** Not for savings, not for anything. The canonical savings glyph is Lucide
  **`Coins`**. This is a religious constraint, not a style preference.
- 🚫 **No notification bell on native.** The mobile header is avatar + greeting only.

### Icons
Lucide, outline only, 1.75–2px stroke, never filled. Do not switch icon libraries.

### The FAB
A **54×54px rounded square** (18px radius) in brand teal with a 4px ring in the nav surface colour,
notched up into the bar. Not a circle.

## 9b. Three additional design tasks (in scope for this brief)

**1. The logo.** Buddget needs a real mark, not the placeholder wallet glyph in the revamp kit.
Design an icon that works at app-icon size and at 26px in the header, in the teal system, light and
dark. Keep the existing **wordmark** ("Buddget" with the accented "d" — the "d" is already teal) and
deliver the icon+wordmark lockup. Show **3–4 distinct directions** before converging; this is
identity work and deserves options. Avoid: generic wallets, generic coins, piggy banks of any kind,
and anything that reads as a banking-app cliché.

**2. The custom calendar.** `UnifiedDatePicker` keeps its current **function** and the month-switch
behaviour exactly as they are — this is a visual redesign only, on the new tokens. Today it carries
a lot of leftover heavy styling. Make it calmer: clear today/selected/disabled states, a legible
week grid at 375px, range selection for the custom From/To period, and Arabic-safe layout. Deliver
month view, a selected range, and the month/year switcher.

**3. Hero and stats.** Rebuild the hero and the stat tiles to be **simpler, more informative and
easier to read** than today. The revamp kit's direction is a teal gradient hero carrying one big
number with a sparkline and a delta chip, over a row of three compact KPI tiles. Apply that to
Flow's in/out/net (§4.1) and show the collapsed sticky state. Fewer numbers, better hierarchy —
if a number does not change a decision, cut it.

---

## 10. Deliverables

1. **Screens** (dark + light, 390×844):
   - Flow / All — hero expanded, mixed ledger
   - Flow / All — scrolled, compact sticky hero
   - Flow / In — with the overdue-payday line and the unmatched-income chip both present
   - Flow / In — the calm state: nothing overdue, nothing unmatched (prove it costs zero space)
   - Flow / Out — two filters applied, result count visible
   - Paydays — the stream list
   - Paydays — stream detail with the full timeline, one payday selected showing actions
   - Paydays — empty state (first run)
   - A filter bottom sheet (period, with custom From/To)
2. **States**: empty (no data), empty-after-filter with Clear filters, loading skeleton, offline with
   pending SMS captures, and one day group containing a declined + a refunded + a late-income row.
3. **The Flow tab icon** SVG, plus the nav bar with it, active and inactive.
4. **Annotated spec**: tokens per surface, px sizes, the sticky-hero scroll threshold and transition,
   tap targets, RTL mirroring notes, motion (durations/easing) for segment change, hero collapse and
   payday selection.
5. **One self-contained HTML prototype** using the real CSS custom properties, with the segment,
   hero collapse-on-scroll and one payday interaction working.
6. **Migration note**: which existing components survive unchanged (`TransactionRow`,
   `SwipeToDelete`, `MonthYearPicker`, `RecurringIncomeCard`, `PaydayTimeline`, `IncomeTypeIcon`,
   `AccountChip`, `ExpenseFilters`), which gain a prop, which are new.
7. **The logo**: 3–4 directions, then the chosen mark as SVG at app-icon and header sizes, light and
   dark, plus the wordmark lockup.
8. **The calendar**: month view, selected range, month/year switcher — new visuals, same function.
9. **Hero + stats**: expanded and collapsed, both themes.

---

## 11. Do not

- Stack two full-width hero cards.
- Put the recurring carousel, or any always-on payday timeline, in Flow.
- Give income its own section in the merged scroll.
- Encode direction in colour alone.
- Hide filters or the month pager behind an extra tap.
- Build YNAB-style budget allocation.
- Make payment methods a peer of Flow.
- Invent accent colours, gradients, radii or font sizes outside the system.
- Use red for anything that is not destructive or an over-budget alert.
- Use `--color-brand-primary` as a text colour (it fails contrast — use `-ink`).
- Change the header contents, the profile placement, or the menu structure — those stay as they are.
- Use emoji as iconography.
- Design desktop-first; mobile-first, then note centring at `max-w-screen-sm`.

---

## 12. Acceptance test

Answer each in one line in the handoff:
1. Where do I see net flow for this month, and how many taps to only outflows?
2. My salary is 3 days late — what do I see, and where?
3. Nothing is late and nothing is unmatched — how many pixels does the payday machinery cost?
4. How do I add a new salary, and how do I reorder my streams?
5. A stray credit arrived that is probably my salary — how do I link it, without knowing the word "assign"?
6. I linked a credit that landed 3 days after its payday — does the UI still know it was late? (If not, §8.0 was not fixed.)
7. I answered "No, keep separate" to the match banner — what guarantees it never asks me again for that pair?
8. How do I confirm a bank-SMS-parsed transaction from this screen?
9. How does a refunded expense and a 3-days-late salary look in the same day group?
10. What does Flow look like with 40 transactions and no budget set?
