# Archived features

Things removed from the UI on purpose and kept here so they can come back.

## "Check against my messages" switch (accounts)

Removed 2026-10: every account is now checked against its bank messages. The switch was in `AddAccountSheet.tsx` (a `Switch` under the last-four field, state `track`, written as `trackSms`).

- Still present: `payment_methods.track_sms` (always written `true`), `PaymentMethod.trackSms`, the import schema field, and the `accountsPage.checkMessages` / `checkMessagesSub` strings in the dictionaries.
- To bring it back: render a `Switch` bound to `trackSms` in the add and edit sheets, stop forcing `true` in `paymentMethodMapper.ts`, and restore the `trackSms === false` checks in `useAccountGaps.ts` and `balanceReport.ts`.
