import { LegalSection } from '@/components/legal/LegalSection'

const strong = 'text-[var(--color-brand-text-primary)]'

/** Sections 7A–7C: buddget Pro and the free trial, Sparks, Rewards and invites. Numbered 7A–7C so the existing section references stay valid. */
export function TermsPlansSections() {
  return (
    <>
      <LegalSection title="7A. buddget Pro, the Free Trial and Refunds">
        <p>
          <strong className={strong}>Free and Pro.</strong> The core of buddget stays free, including SMS
          tracking, budgets, goals, debts, reports and export, with weekly limits on AI features.
          buddget Pro adds higher AI limits, the Buddgy Advisor and other features shown in the app.
          What each plan includes is listed in the app and may change; if a feature that is free today
          moves into Pro, we give at least 14 days&apos; notice.
        </p>
        <p>
          <strong className={strong}>30-day trial, once.</strong> A new account starts with every Pro
          feature for 30 days, with no card. When it ends you move to Free automatically; nothing is
          charged and nothing is deleted. The trial can be claimed once per person: it is tied to your
          verified email address, so a second account, another address for the same mailbox, or
          signing up again after deleting your account does not start another trial. A friend who
          joins through an invite gets 7 extra days (37 in total).
        </p>
        <p>
          <strong className={strong}>Subscriptions.</strong> Pro is an auto-renewing subscription,
          monthly or yearly, at the price shown in the app and the store. Payment is charged to your
          App Store or Google Play account when you confirm the purchase. It renews automatically
          unless you cancel at least 24 hours before the end of the current period, and your account is
          charged for the renewal within 24 hours before the period ends. Manage or cancel in your
          store account settings; the Manage option in the app opens them. Deleting the app or your
          buddget account does not cancel a subscription: cancel it in the store. If a price changes,
          the store tells you and asks for your consent where the law requires it.
        </p>
        <p>
          <strong className={strong}>Refunds.</strong> Apple and Google take the payment and decide
          refunds under their own rules; you can ask for one in your store account. If a purchase is
          refunded or a subscription ends, Pro access ends with it. Changed your mind within 30 days of
          buying the yearly plan? On Android, tell us at{' '}
          <a href="mailto:support@buddget.app" className="text-[var(--color-brand-primary-ink)] hover:underline">
            support@buddget.app
          </a>{' '}
          and we refund you. On iPhone, Apple handles refunds: we show you how to ask, and if Apple
          says no we add 3 months to your plan. This applies to the yearly plan only, once per
          subscription. Nothing here limits rights you have under the consumer law where you live.
        </p>
      </LegalSection>

      <LegalSection title="7B. Sparks">
        <p>
          Sparks are in-app credits that pay for extra AI use once your plan&apos;s allowance is used.
          Packs are one-time purchases through the App Store or Google Play and are not a subscription.
          Sparks you buy do not expire. Sparks given as a reward are valid for 12 months and are spent
          before bought ones. Sparks have no cash value, cannot be transferred or exchanged for money,
          and Sparks already spent are not refunded. If the store refunds a pack, the Sparks from it
          (including any bonus) are removed. Pro members and loyal Pro members may receive bonus Sparks
          on packs, as shown in the app. We may change prices and pack sizes for future purchases.
        </p>
      </LegalSection>

      <LegalSection title="7C. Rewards, Points and Invites">
        <p>
          <strong className={strong}>Points and tiers.</strong> You earn loyalty points for real use of
          the app, such as keeping a week of reviewed transactions, setting a budget and fully tracking
          a month. Points, tiers, streaks, freezes and card finishes have no cash value, cannot be
          transferred, sold or exchanged for money, and involve no chance or payment. We may adjust the
          programme, and we may remove points or rewards earned through misuse.
        </p>
        <p>
          <strong className={strong}>Invite a friend.</strong> Every account has an invite link and
          code. A friend who joins with it gets the 37-day trial described above. You get 1 week of Pro
          for each friend who becomes active (used the app on 3 separate days and logged at least 5
          transactions in their first 14 days), or 500 Sparks if you already pay for Pro through a
          store. Rewards are limited to 4 a month and 12 a year, and banked weeks start when your trial
          or Pro time ends. Signing up alone earns nothing.
        </p>
        <p>
          <strong className={strong}>Fair use.</strong> One reward is given per new account and per
          device, and a mailbox can be invited only once. You may not invite yourself, create accounts
          with disposable or look-alike email addresses, or use more than one account to collect
          rewards. We use a device identifier and a coarse network indicator to check this (see the
          Privacy Policy). We may hold a reward for review, refuse it, or take it back, for example if
          the invited account is deleted within 30 days, and we may suspend the invite programme at any
          time.
        </p>
      </LegalSection>
    </>
  )
}
