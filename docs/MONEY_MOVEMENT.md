# Money movement — payment method types and what each transaction means

Why this exists: the SMS pipeline sees *events*, not intent. Two SMS that look like a
purchase and an income can be one person moving their own money. Getting this wrong does
not just mislabel a row — it invents spend or invents income, and both corrupt every total
downstream. This is the reference for which is which.

## The one rule

**Money that stays inside the user's own methods is never spend and never income.**
It nets to zero and belongs in a non-spend category (`NON_SPEND_CATEGORIES` in
`categoryMeta.ts`). Spend is recognised when money leaves for a real counterparty; income
when it arrives from one.

Everything below is an application of that rule.

## The 8 types, by what they actually are

| Type | Holds a balance? | Has a last4? | Spending from it is… |
|---|---|---|---|
| `cash` | yes (physical) | no | spend |
| `bank_account` | yes | yes | spend |
| `debit_card` | no — draws on a bank account | yes | spend |
| `credit_card` | no — accrues debt | yes | spend (debt settled later, non-spend) |
| `prepaid_card` | **yes (stored value)** | yes | spend (loading it is not) |
| `wallet` | **yes (stored value)** | optional | spend (topping it up is not) |
| `bnpl` | no — accrues debt | no | spend at checkout (installments non-spend) |
| `other` | unknown | no | spend |

Two distinctions matter more than the type itself:

**Stored value vs pass-through.** `wallet` conflates them. Barq, STC Pay, urpay, Vodafone
Cash and Telda hold a balance you top up and spend down. Apple Pay, Google Pay, Samsung Pay
and InstaPay hold *nothing* — Apple Pay tokenises a card, InstaPay is the CBE's bank-to-bank
rail. "Topping up Apple Pay" is not a thing; a payment through it is the underlying card
paying. Catalogue flag: `passThrough`. These are in the SA/AE/EG quick-add lists, so real
users have them registered — top-up logic must exclude them or it erases real spend.

**Wallets can issue cards, and the card is part of the wallet.** Telda, Barq and STC Pay
issue physical/virtual cards. We do *not* model those as a separate `prepaid_card` — one
wallet method, with an optional last4 so the card's SMS attribute back to it. That is why
`wallet.allowsLast4` is true even though many wallets (Vodafone Cash) have no card.

**Some brands are also merchants.** You can buy fuel from ADNOC and pay bills at Fawry,
*and* they are payment brands. For those, "merchant is my own method" cannot mean top-up on
its own. Catalogue flag: `alsoMerchant` — those require explicit top-up wording as a second
signal. Without it, a tank of fuel silently becomes a transfer and leaves spend entirely.

## The scenarios

`✅` handled and regression-tested · `⚠️` handled only under a stated condition · `❌` gap

### Spend — money leaves for a real counterparty
| Scenario | Treatment | State |
|---|---|---|
| Purchase from cash / bank / debit / credit / prepaid / wallet | expense, real category | ✅ |
| Purchase at a merchant that is *also* a payment brand (fuel at ADNOC) | expense — **not** a transfer | ✅ `alsoMerchant` |
| Purchase via a pass-through rail (Apple Pay at a shop) | expense on the underlying card | ✅ `passThrough` |
| BNPL checkout | installment debt; purchase counts once at checkout | ✅ |
| Transfer fee on top of a payoff | its own expense — a fee is consumed | ✅ |
| Send money to another person (InstaPay / wallet → friend) | `Remittance` — spend | ✅ |

### Non-spend — money stays inside the user's own methods
| Scenario | Treatment | State |
|---|---|---|
| Bank/card → own wallet (**top-up**) | one `Transfer`, both arrival orders | ✅ |
| Bank/card → own prepaid card (**reload**) | one `Transfer` | ⚠️ needs top-up wording when `alsoMerchant` |
| Own wallet → own bank (**withdrawal / cash-out**) | one `Transfer` | ✅ retags the provisional `Remittance` |
| Own wallet → own wallet | one `Transfer` | ✅ same path as withdrawal |
| Bank → own bank | one `Transfer` | ✅ counterparty last4 |
| Bank → own credit card (**payoff**) | debt payment, non-spend; fee split out | ✅ |
| BNPL installment payment | `Installment`, non-spend | ✅ |
| ATM withdrawal (bank → cash) | `ATM Cash Withdrawal`, non-spend | ✅ |
| FX between own currency accounts | `Currency Exchange`, non-spend | ✅ |
| Cash → wallet at an agent | single leg, no sibling SMS | ❌ unknowable from SMS |

### Income — money arrives from a real counterparty
| Scenario | Treatment | State |
|---|---|---|
| Salary → bank | income, matched to the recurring template | ✅ |
| Friend sends money to your wallet | **income** — no card of yours funded it | ✅ |
| Refund / reversal | reverses the original expense | ✅ |

## How a two-leg movement is identified

One movement, two independent SMS, seconds apart, in **either order**. Both must land in
the transfer family or they can never find each other.

1. **Counterparty last4 matches a registered method** → own transfer. (`isOwnAccountTransfer`)
   Works for banks and cards. Cannot work for a wallet with no card.
2. **Merchant IS one of my stored-value methods** → the funding leg of a top-up.
   Matched on the *whole* merchant string, never a substring or brand alias: `careem` is an
   alias of the Careem Pay wallet, so alias matching turns every ride into a transfer.
   Exact matching fails safe — an unrecognised top-up stays spend, which is the status quo.
3. **The wallet's own SMS names it** → *candidate* only. Money added to your wallet is real
   income when nobody's card funded it, so this leg pairs only if the sibling is actually
   there, and books as income otherwise.

Then `sms_try_pair` (migration 0089) claims the sibling atomically and the pair is
represented **once**.

### The trap
`sms_try_pair` matches on the **persisted `kind` column**. Reclassifying `kind` inside
`createSmsTransaction` is invisible to pairing unless the route writes `tx.kind` back —
`purchase`/`online_purchase`/`income` are in no `matchKinds` array, so such a leg is
unpairable forever. This silently defeated the first version of the top-up fix, and its
unit tests passed anyway. Tests for this area must assert **row counts** through
`createSmsTransaction`, not matcher return values.

## Known gaps

- **Cash → wallet at an agent**: one leg, no sibling. Not knowable from SMS alone.
- **Prepaid reload for `alsoMerchant` brands** depends on top-up wording we have not seen a
  real sample of. It fails safe (stays spend) when the wording is absent.
- **A wallet named after a merchant** ("Lucky", "Fawry") that also *charges* you under that
  exact merchant name is genuinely ambiguous at one leg. The sibling probe resolves it when
  both legs arrive.
