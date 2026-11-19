# iOS SMS tracking: what Apple allows, what we ship

Written 2026-10-23 after checking production data and Apple's current options.

## Finding: the "Sender" step never worked

`sms_parse_log` (all iOS shortcut traffic, `source = 'sms'`): **824 messages, 7 users, 2026-06-16 to 2026-10-22, 0 with a sender.**
The Shortcuts *Message* automation hands an action the message text and nothing about who sent it, so the "pick the Sender variable"
step in the guide (and the Sender field on the `Catch Bank SMS` action) collected nothing. The blue "Sender" pill in the old
screenshots was just the empty-parameter placeholder, not a variable.

Removed: the guide step, the Sender field from the action's summary (the parameter itself stays, hidden, so automations already
built with the old two-field action keep running), and every claim in the copy that it names the bank.

Replaced by `src/lib/sms/providerFromBody.ts`: the provider is read from what the message prints (bank or wallet name in English or
Arabic, "From HSBC:", a customer-service hotline), deterministic, free, ahead of any AI. It fills `bank_name` when no tier named one,
which feeds wallet attribution, template keys and the provider shown on the row.

## Options Apple offers (checked against current docs and developer threads)

| Option | Gives us | Verdict |
|---|---|---|
| **Shortcuts "Message" automation + App Intent** (what we ship) | The message text, run immediately, in the background, even with the app closed. Criteria: *Sender* (contacts) and *Message Contains* (one phrase, no regex). | The only supported way to read bank texts. Keep. Cost: one automation per keyword. |
| **Shortcuts "Transaction" automation** (iOS 17+) | Structured data when a Wallet card is used: card, merchant, amount. No parsing. Works for Apple Pay, which launched in Egypt in Dec 2024 with NBE, Banque Misr and CIB. | Best complement for card purchases (instant, no regex), but it only sees Wallet payments (no ATM, transfers, incoming money, balances), fires even for declined payments, and developers report timeouts. Needs a device-tested App Intent and de-duplication against the SMS for the same purchase. Recommended next step, not shipped. |
| **Message Filter extension** (`ILMessageFilterExtension`) | Sender and body, but only for *unknown* senders, and only to classify (allow / junk / promotion / transaction) | A spam-filtering API. Using it to harvest finance data is outside its purpose and a review risk. Not used. |
| Reading the Messages database | nothing | Not available to apps. |

iOS 27 reportedly rebuilds Shortcuts so the trigger is the first action of a shortcut instead of a separate Automation tab. The
guide's first two steps (Automation tab, + button) should be re-checked on an iOS 27 device before the next release.

## What changed in the guide

Eight steps instead of fifteen, drawn with buddget's own tokens instead of annotated screenshots (the old ones showed the previous
red app icon and the Sender field). Apple's own labels ("Automation", "Message Contains", "Run Immediately", "Shortcut Input") stay in
English in the illustrations: they are what the reader has to match on the phone.

Open: Arabic-iOS wording of those labels (the step text names them in English), and a real-device walkthrough of the new flow.

## Two automations on one phone

The setup guide still recommends a second automation (a second keyword) so more messages are caught. One SMS that matches both
runs `CatchBankSmsIntent` twice within moments, and each run used to mint its own capture id and capture time, so the server saw
two different captures of one message.

The intent now keeps up to 8 recent runs (sha256 of the normalised text, capture time, capture id) for 15 seconds, in the same
Keychain-backed storage and under the same lock as the pending queue (`SmsCredentialStore.captureIdentity`, rule in
`SmsCaptureRepeat`). A run whose text matches a run younger than 15 seconds reuses that run's id and time, so the server sees one
capture sent twice and collapses it. Text is normalised like the server's dedup hash (trim, collapse whitespace, lowercase). Two
genuine identical messages more than 15 seconds apart still get separate captures. If the Keychain cannot be read the run mints
a fresh identity, and the server's same-capture-time guard is the backstop.

## One automation instead of four (2026-11-19)

Apple gives apps no API to create a Shortcuts automation, so setup stays manual. This cuts it down.

- **Keyword "0".** "Message Contains" takes one phrase, so each keyword was its own automation. Of 229 booked bank texts
  with raw text still kept, the best word ("EGP") was in 116; "0" was in 226. The guide now uses "0" and offers "1" as an
  optional second automation. Texts with Arabic-Indic digits only (٠) would be missed; none in the sample.
- **On-device filter.** With "0", personal texts reach the action too. `SmsOtpGate.looksLikeBankMoney` sends a text only
  when it names an amount with a currency, or states money moving; everything else is dropped on the phone
  (`skipped_not_money`). The stricter `carriesMoneyMovement` alone missed 15 of the 229 (transfers in, salary, card
  payoff). TS mirror and tests: `src/lib/sms/deviceOtpGate.ts`.
- **Notify When Run off.** With a broad keyword, the guide now says to turn it off, or every text with a 0 shows a banner.
- **Bank Message pre-wired.** The parameter asks for `inputConnectionBehavior: .connectToPreviousIntentResult`. Whether
  Shortcuts fills in Shortcut Input for the first action of a Message automation is unconfirmed, so the guide step now
  says "check it says Shortcut Input, and pick it if not".
- **App Shortcut.** `BuddgetAppShortcuts` lists Catch Bank SMS under buddget in the Shortcuts app.
- **Test step.** The user texts themself `buddget test 0`. The action stamps `lastRunAt` before any gate, and the guide
  polls `getStatus` and shows "Connected". The test text carries no currency, so nothing is booked.

Device checks still open: that "0" matches as plain text, that a text to your own number fires the automation, the
auto-wired input, and the App Shortcut phrase compiling on Xcode.
