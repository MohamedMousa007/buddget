# Subscriptions redesign · design spec

## 1. Principles
Calm, one idea per surface, one primary action, almost no chrome. A subscription is a **forecast until a charge lands**. Numbers first, sentence case, no marketing copy.

## 2. Tokens
All colour via `var(--color-brand-*)`.

| Use | Token |
|---|---|
| Page | `--color-brand-bg` |
| Card, sheet | `--color-brand-card`, border `--color-brand-border`, `--shadow-sm` (cards), `--shadow-lg` (sheet, FAB) |
| Inputs, chips, logo tile ground | `--color-brand-elevated` |
| Text | `text-primary`, `text-secondary`, `text-muted` |
| Hero fill / primary buttons | `--color-brand-primary`, text `--color-brand-on-primary` |
| Teal text and links | `--color-brand-primary-ink` |
| Chart/progress fill, icon accents | `--color-brand-primary-bright` (never text) |
| Chip tints | neutral `elevated`, amber `amber-soft`, info `primary-soft`, success `green-soft` |
| Destructive | `--color-brand-red`, `red-soft`, `red-text` (cancel/delete button, over-plan bar only) |

Type: DM Sans UI; JetBrains Mono (`font-mono-numbers`) for every amount, date, percentage; IBM Plex Sans Arabic in AR.
Radius: controls 12, cards 16, sheet top 24, chips full, logo tile 12 (56 px tile: 16).
Hit areas: inputs and buttons 48 px, icon buttons and chips 44 px minimum.

## 3. Components
Existing: `Button` (default = primary teal, outline, ghost, destructive, secondary), `OptionChip`, `SegmentedControl`, `Switch`, `Sheet`/`ModalShell` with pinned footer, `Dialog` (desktop), `Card`, `EmptyState`, `OfflineBanner`, `PromptBanner`, `SkeletonList`, `StatTile`.
Proposed (compose existing, no new tokens):
- **SubscriptionRow**: 40 px logo tile, name + `· plan` (plan in text-secondary), second line = date (mono) + tracking icon (12 px, muted) + status chip, right = amount (mono 15/600) over optional sub-line (USD amount or `n / mo` for yearly). Min height 64, padding 10 14, gap 12.
- **StatusChip**: `Badge` preset, 11/600, padding 2 8, optional 11 px leading Lucide icon.
- **BrandTile**: 40 px (56 on add grid, 44 on SMS card), `elevated` ground, `object-fit: contain`, padding 5 to 7, never recoloured. No logo: first two letters, 13/700, `primary-ink`. Wide wordmarks and square marks use the same tile.
- **ConfidenceMeter**: three bars 5 px wide, heights 6/10/14, filled `primary-bright` (High 3, Medium 2, Low 1), rest `border`.

## 4. Icons (Lucide, outline, stroke 1.75)
Subscriptions glyph: `rotate-cw-clock`:
```
<path d="M12 7v5l4 2"/><path d="M16 8h5V3"/><path d="m21 8-2.3-2.3A9.7 9.7 0 0 0 12 3a9 9 0 1 0 9 9"/>
```
Tracking: `message-square` (SMS), `circle-help` (ask), `zap` (auto). Chips: `clock` (due soon, expected, trial), `trending-up` (price), `repeat` (plan change), `triangle-alert` (failed), `users` (shared), `check`, `link`, `unlink`. Category chips: `tv`, `music`, `gamepad-2`, `wifi`, `sparkles`, `cloud`, `dumbbell`, `shopping-bag`, `graduation-cap`, `newspaper`, `ellipsis`.

Placement of the Subscriptions glyph:
1. Budget Committed card, entry row under the fixed items: 40 px `primary-soft` tile, `primary-ink` glyph 20 px, title, line `7 due · Netflix 19 Oct`, left-to-pay amount, chevron. Opens Subscriptions.
2. Budget plan list: row for the Subscriptions category, same tile (primary-soft because it links out), progress bar actual vs plan.
3. Quick add sheet: third tile beside Expense and Income, opens add step 1.
4. Desktop sidebar, More group: item with 20 px glyph (text-secondary, `primary-ink` when active).
5. Flow ledger: Subscription chip keeps the glyph at 11 px plus the `link` icon on matched charges.

## 5. Layout

### Home (mobile 390)
- Hero band, fixed **191 px**, same in loading/empty/data: header 48 (back + title 16/600), label row 22 (12/600), number row 34.5 (EGP 14/600 + amount mono 30/600, -0.02em), progress block 38.75 (6 px bar, `on-primary` fill on 30% white track, Paid left / Left right 12/500), stat strip 66 with three cells (Monthly equivalent · Per year · Next charge name + date), 1 px top rule rgba white 30%. Cells separated by padding only.
- Body padding 16, gap 14: period row (15/600) + `n active` (12), SegmentedControl Upcoming · All · Ended, optional nudge, groups.
- Group: label 11/700 uppercase tracking .08em muted + total mono 12 secondary; rows in one Card (16 radius, border, shadow-sm), hairline between rows.
- Collapsed Paused and Cancelled: one Card, 48 px rows with count and chevron.
- Bottom nav 68 px: Flow · Budget (active) · FAB 56 px · Wealth · Debts. FAB opens quick add.
- Nudge: single row, `elevated` surface, 16 radius, icon (`primary-ink`), text 13, action (`primary-ink` 13/600, 44 px tall), dismiss. Never red. One at a time.

### Home (desktop 1440)
Hero full-bleed, content aligned to the body container (max 1100). Body grid: primary column + 22 rem rail, 32 px gap, 1 px hairline between columns. Rail: "Next 30 days" strip (10 columns, 44 px cells, today in `primary-soft`, `primary-bright` dot on due days), then at most two insight cards (price changes, trials ending). Add and detail open as centred dialogs, 28 rem (448 px) wide, 24 radius.

### Sheets (mobile)
Top gap 48, radius 24 top, handle 20, header 48 (title 18/600 + 44 px close), body padding 4 20 16 (gap 16), pinned footer padding 12 20 20 with top hairline. Footer: optional impact line (13, mono) then full-width `Button` size lg. Secondary footer action is `ghost`.

## 6. Screens

1. **Home** (above). Overdue group first, then This week (0 to 7 days), This month (8 to 14), Later (15+), Yearly. Trial rows: amount struck through and muted, chip "Trial ends".
2. **First-run empty**: heading "Add your subscriptions", sub "Tap a service to add it with its usual price.", 3x2 tiles (Netflix, Shahid, Spotify, Anghami, YouTube Premium, Apple Music) each: 40 px BrandTile, name 12/600, price mono 11 (`EGP 190.00`, USD plans `≈ $20`). Then **Add subscription** (primary, lg, plus icon) and **Scan my SMS** (outline, lg). Hero shows zeros and dashes, same 191 px.
3. **SMS detection** (prompt via existing dropdown prompt stack: "Found 3 possible subscriptions · Review"; full sheet): summary strip (`primary-soft`, scan icon, "14 messages scanned · last 90 days", "Nothing is added until you confirm."). One Card per find: BrandTile 44, merchant 16/600, line (Monthly · day 19), amount mono 17/600 + currency or EGP estimate; row with ConfidenceMeter + label and dates seen as mono pills; SMS excerpt box (`elevated`, 10 radius, mono 12); optional link line (`primary-ink` 12/600, link icon) when it matches an existing manual subscription ("Matches your Netflix. Charges link to it"). Actions: two real `Button`s side by side, equal width, 48 px: **Not a subscription** (outline) and **Add** (primary; label becomes **Link to Netflix** when absorbing). Pinned footer: **Add N subscriptions**. Absorb into existing instead of duplicating.
4. **Add step 1**: search field 48 px, category chips (OptionChip sm, Lucide icon 16 + label, horizontal scroll), "Popular in Egypt" label, 3-column grid of BrandTile 56 + name + price, last tile dashed "Custom". No recents. Order by Egyptian usage: Netflix, Shahid, Spotify, Anghami, YouTube Premium, Watch iT, Amazon Prime, PlayStation Plus, Xbox Game Pass, ChatGPT, Microsoft 365, iCloud+, Google One, Vodafone/Orange/e&/WE, gyms, talabat Pro, Noon One, Uber One, Careem Plus.
5. **Add step 2 (configure)**: brand header (48 px tile, name, category · billing note), plan cards 2-up (name, price, check when selected, 2 px primary border when selected), amount row (48 px field + EGP/USD SegmentedControl 168 px), EGP estimate line (`≈ 1,069 EGP at 53.45 · refined after the first charge`), first-charge date field + cycle select, payment method chips (Card, Carrier billing, Vodafone Cash, Fawry, InstaPay, Cash, Wallet), tracking mode as three selectable cards, reminder Switch, collapsed "More: trial, sharing, category, notes". Footer impact line `+EGP 1,069 / month` · `Committed becomes 3,269` above one CTA `Add ChatGPT Plus`. Edit uses the same sheet prefilled, title "Edit".
6. **Detail sheet**: BrandTile 56, name, plan, status chip; amount mono 28/600 + `EGP per month`; optional state banner (radius 16, tinted); Next charges (3 rows); Tracking card with Change; Matched charges (link icon, date, amount, unlink 44 px); Price history list; actions Edit · Pause/Resume · Cancel subscription (destructive). Footer CTA depends on state.
7. **Cancel confirm**: tile, name, price; Ends on date field with note "Last paid cycle. You keep access until then."; how-to-cancel card (service hint and link from catalog `cancel_hint`); effect text; footer destructive **Cancel subscription** + ghost **Keep it**. No dark patterns.
8. **Budget links**: see section 4 placements. Committed card: label COMMITTED, amount mono 30, `EGP`, line below `left to pay this month`, entry row, `Set aside for yearly plans` row. Over plan: bar `red`, note `red-text` ("123 over budget"); this is the only red outside destructive buttons.
9. **Notifications**: see copy section.

## 7. Behaviour
**Forecast until charged.** When an SMS/expense matches (merchant alias and amount within tolerance) or user taps Mark paid, that cycle becomes Paid and the forecast is not counted again. Paid advances next charge by one cycle.

**Tracking modes** (per subscription, default `sms`; icon on every row, name on detail):
- `sms` Match from SMS: link the charge when merchant and amount match.
- `ask` Ask me on the due date: one-tap Paid / Not yet prompt.
- `log` Log automatically: create the expense on the due date; a later SMS adopts it instead of duplicating.

**Lifecycle**: Active · Trial (end date, alerts 2 days before and on the day, excluded from Committed until converts) · Paused (no charges, no reminders, Resume) · Cancelled (access until `endsOn`, then archive to Ended, Resubscribe) · Pending plan change (Apply plan change) · Price changed (last charge differs >5% from plan: Adopt keeps history) · Expected, not seen (grace 3 days after due, then ask) · Failed payment (from bank SMS, amber, never red) · Shared (my share counts).

**Cycles**: weekly, monthly, quarterly, semiannual, yearly; month-end clamping (31 Jan to 28/29 Feb then back to 31 Mar as billing day); yearly shows monthly equivalent and set-aside line.

**Money**: USD plan shows `≈ EGP` with the USD amount below; estimate refined by last real EGP charge; show "FX +n%" when drift passes threshold. Shared plans use `myShare`. Card/BNPL-funded subscriptions follow the two-ledger rule: spend counts in the month it is charged.

**Hero numbers**: due30 = sum of active forecast charges with due date within 30 days; paid = paid this month; left = due in month not yet paid; monthly equivalent = sum(amount / cycle months) of active; per year = monthly × 12; next charge = earliest upcoming active.

**Budget Committed**: left-to-pay = sum of real due dates remaining this month (not /12). Yearly plans are separate: set-aside = sum(amount / 12).

**Reminders**: one daily digest. Defaults 3 days before and on the day; 7 days and 1 day for yearly plans and trials. Nothing for paused or cancelled. Settings are two switches (Due date reminders; Price and trial alerts).

**Nudges** (max one visible): price rise, trial ending, "Still using X?" (monthly), plan moved up. Dismissible.

**Offline**: all reads and writes local, sync later. Offline banner uses `elevated` surface.

## 8. Data model
```ts
type Cycle = { unit: 'week'|'month'|'year'; every: number };           // quarterly = {month,3}, semiannual = {month,6}
type Tracking = 'sms'|'ask'|'log';
type Status = 'active'|'trial'|'paused'|'cancelled';
interface Subscription {
  id: string; name: string; brandKey?: string; planId?: string; planName?: string;
  amount: number; currency: 'EGP'|'USD'|string; amountEgpEstimate?: number; fxDrift?: number;
  cycle: Cycle; firstChargeDate: string; billingDay: number;
  status: Status; trialEnd?: string; endsOn?: string; pausedAt?: string;
  paymentMethod: 'card'|'carrier'|'vodafone_cash'|'fawry'|'instapay'|'cash'|'wallet';
  tracking: Tracking;                       // NEW, default 'sms'
  reminder: boolean;
  sharedWith?: string[]; myShare?: number;
  priceHistory: { amount: number; from: string }[];   // NEW
  pendingPlanChange?: { planId: string; amount: number; from: string };  // NEW
  category?: string; notes?: string; createdAt: string;
}
// Derived (not stored): nextCharge, paidThisCycle, monthlyEquivalent, egpEstimate,
// overdue (nextCharge < today - grace), priceChanged (|lastCharge - amount| / amount > 0.05)
```
New fields vs current app: `tracking`, `endsOn`, `priceHistory`, `pendingPlanChange`, `trialEnd` (if absent), `myShare`. Charge linking: store `subscriptionId` on the expense and render the `link` icon plus Subscription chip in Flow.

## 9. Copy (EN / AR)
| Key | EN | AR |
|---|---|---|
| Title | Subscriptions | الاشتراكات |
| Hero label | Due in the next 30 days | مستحق خلال 30 يومًا القادمة |
| Strip | Monthly equivalent · Per year · Next charge | المعادل الشهري · في السنة · الخصم القادم |
| Segments | Upcoming · All · Ended | القادمة · الكل · المنتهية |
| Groups | Overdue · This week · This month · Later · Yearly | متأخر · هذا الأسبوع · هذا الشهر · لاحقًا · سنوي |
| Paused / Cancelled | Paused · Cancelled | متوقف مؤقتًا · ملغى |
| Empty title | Add your subscriptions | أضف اشتراكاتك |
| Empty sub | Tap a service to add it with its usual price. | اضغط على خدمة لإضافتها بسعرها المعتاد. |
| CTAs | Add subscription · Scan my SMS | إضافة اشتراك · افحص رسائلي |
| SMS sheet | Found 3 possible subscriptions · 14 messages scanned · last 90 days · Nothing is added until you confirm. | وجدنا 3 اشتراكات محتملة · تم فحص 14 رسالة · آخر 90 يومًا · لا يُضاف شيء قبل تأكيدك. |
| SMS actions | Not a subscription · Add · Link to Netflix · Add 3 subscriptions | ليس اشتراكًا · إضافة · ربط بـ Netflix · إضافة 3 اشتراكات |
| Match line | Matches your Netflix. Charges link to it | يطابق Netflix الحالي. تُربط الخصومات به |
| Confidence | High · Medium · Low | مرتفعة · متوسطة · منخفضة |
| Search | Search services | ابحث عن خدمة |
| Popular | Popular in Egypt | الأكثر استخدامًا في مصر |
| Custom | Custom | مخصص |
| Categories | Streaming, Music, Gaming, Telecom & internet, AI & software, Cloud, Fitness, Shopping & delivery, Learning, News, Other | بث، موسيقى، ألعاب، اتصالات وإنترنت، ذكاء اصطناعي وبرامج، تخزين سحابي، لياقة، تسوق وتوصيل، تعلّم، أخبار، أخرى |
| Configure | Amount · First charge · Cycle · Paid with · Tracking · Remind me before it’s due | المبلغ · أول خصم · الدورة · طريقة الدفع · التتبّع · ذكّرني قبل الاستحقاق |
| FX line | ≈ 1,069 EGP at 53.45 · refined after the first charge | ≈ 1,069 ج.م بسعر 53.45 · يُحدَّث بعد أول خصم |
| Tracking | Match from SMS · Ask me on the due date · Log automatically | مطابقة من الرسائل · اسألني في يوم الاستحقاق · تسجيل تلقائي |
| Impact | +EGP 1,069 / month · Committed becomes 3,269 | +1,069 ج.م / شهر · الملتزم به يصبح 3,269 |
| Status chips | In 2 days · Today · Trial ends · Paused · Ends 26 Oct · Expected, not seen · Price +10.5% · Plan changes 2 Nov · Payment failed · Shared · 2 · Estimate | بعد يومين · اليوم · تنتهي التجربة · متوقف مؤقتًا · ينتهي 26 أكتوبر · متوقع، لم يظهر · السعر +10.5% · تغيير الخطة 2 نوفمبر · فشلت الدفعة · مشترك · 2 · تقدير |
| Detail | Next charges · Tracking · Change · Matched charges · Price history | الخصومات القادمة · التتبّع · تغيير · الخصومات المطابقة · سجل الأسعار |
| Actions | Edit · Pause · Resume · Cancel subscription · Delete · Resubscribe · Keep it | تعديل · إيقاف مؤقت · استئناف · إلغاء الاشتراك · حذف · إعادة الاشتراك · إبقاؤه |
| Footer CTAs | Mark paid · Keep after trial · Resume · Resubscribe · Adopt EGP 210.00 · Apply plan change | تم الدفع · استمرار بعد التجربة · استئناف · إعادة الاشتراك · اعتماد 210.00 ج.م · تطبيق تغيير الخطة |
| Cancel | Ends on · Last paid cycle. You keep access until then. · How to cancel · Reminders stop and it moves to Ended. Past charges stay in Flow. | ينتهي في · آخر دورة مدفوعة. يبقى الوصول حتى ذلك التاريخ. · كيف تلغي · تتوقف التذكيرات وينتقل إلى المنتهية. تبقى الخصومات السابقة في التدفق. |
| Budget card | Committed · left to pay this month · Set aside for yearly plans | الملتزم به · متبقي للدفع هذا الشهر · مخصص للخطط السنوية |
| Notifications | 2 subscriptions due soon · Shahid VIP trial ends in 2 days · Netflix Premium is now 210.00 · Netflix 190.00 linked to your subscription | اشتراكان قريبان من الاستحقاق · تجربة Shahid VIP تنتهي بعد يومين · Netflix Premium أصبح 210.00 · تم ربط Netflix 190.00 باشتراكك |
| Settings | Due date reminders · Price and trial alerts | تذكيرات الاستحقاق · تنبيهات السعر والتجربة |
| Offline | Offline. Everything works; changes sync later. | لا يوجد اتصال. كل شيء يعمل وتتم المزامنة لاحقًا. |

## 10. Catalog and logos
- Source: `source/uploads/catalog.json` (110 services, 214 plans; each price has confidence and checked date; Arabic and English statement aliases; billing currency; accepted payment methods; cancel hint).
- Show a price as typical only when confidence is `high`. Otherwise `≈` prefix, USD line below, editable. No badge or extra chrome.
- Logos: SVG preferred, fixed tile (40 / 44 / 56), `contain`, never recoloured. 104 of 110 services have a file; some are under 512 px (see `SOURCES.md` in the logo pack). Missing: two-letter fallback on a tinted tile.
- Aliases drive SMS matching and absorbing into existing manual subscriptions.

## 11. Acceptance checklist
1. Hero band is exactly 191 px in loading, empty and data; content aligns with body on desktop.
2. Row shows only logo, name (+plan), date, tracking icon, chip, amount; tap opens detail.
3. Tracking mode visible as row icon and on detail; changeable; default SMS.
4. Every lifecycle state has a row state and a detail state matching screenshots 07 and 08.
5. Trial excluded from Committed until converted; paused and cancelled never charge or remind.
6. Left-to-pay uses real due dates; yearly plans appear only in set-aside.
7. SMS sheet absorbs matches into existing subscriptions; no duplicates; both buttons are real `Button`s (outline + primary), equal width, 48 px.
8. Empty state: primary Add subscription, secondary Scan my SMS, six tiles with prices.
9. Add step 1 has category icons, no recents; step 2 shows impact line above the single CTA.
10. USD plan shows `≈ EGP` with USD below; estimate refines after first real charge.
11. Red appears only on destructive buttons and the over-plan Budget bar.
12. `rotate-cw-clock` used for Subscriptions in Budget entry row, plan row, Quick add, sidebar.
13. Dark theme complete; Arabic mirrored with LTR numerals.
14. Desktop: rail with 30-day strip and at most two insight cards; add/detail as 28 rem dialogs.
15. Everything works offline.
