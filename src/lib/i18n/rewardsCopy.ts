import { useLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n/types'
import type { TierKey } from '@/lib/loyalty/rewardsTypes'

/**
 * Copy for the Pro, Rewards, Founders and Invite screens built from docs/design/pro-rewards/mockup.html
 * (docs/launch/PRO_REWARDS_SPEC.md section 4). `{b}` marks where a component sets a value in bold (see `withBold`).
 * Rules: lowercase "buddget"; "Pro", "Sparks" and "Buddgy" stay in Latin letters inside Arabic; no countdowns or loss copy.
 */
export interface RewardsCopy {
  tiers: Record<TierKey, { name: string; perks: [string, string, string]; ladder: string }>
  tierLabel: (name: string) => string
  plan: {
    freePill: string
    showTitle: string
    showSub: string
    colFree: string
    colPro: string
    now: string
    rows: { label: string; free: string; pro: string }[]
    footnote: string
    trialCta: string
    trialFine: string
    trialUsed: string
    trialFailed: string
    orChoose: string
    yearly: string
    monthly: string
    bestValue: (pct: number) => string
    perMonthBilledYearly: (price: string) => string
    cancelAnyTime: string
    continueYearly: string
    continueMonthly: string
    storeFine: { ios: string; android: string }
    restoreLink: string
    /** The store as a sentence names it. */
    store: { ios: string; android: string }
    notYet: string
    card: {
      flip: string
      markPro: string
      markTrial: string
      lineTrial: string
      linePro: (period: string, store: string) => string
      linePromo: string
      periodYearly: string
      periodMonthly: string
      memberSince: string
      renews: string
      trialEnds: string
      until: string
      member: string
      includedMark: string
      included: (pct: number) => [string, string, string, string]
      thenPrice: (price: string) => string
      noCharge: string
      perYear: (price: string) => string
      perMonth: (price: string) => string
      next: (date: string) => string
      ends: (date: string) => string
      tap: string
    }
    manage: {
      group: string
      statusRenews: string
      statusUntil: string
      statusTrial: string
      noCard: string
      priceYr: (price: string) => string
      priceMo: (price: string) => string
      active: string
      dayOf: (day: number, total: number) => string
      notRenewing: string
      issue: string
      changePlan: string
      choosePlan: string
      manage: string
      restore: string
      receipts: string
      sheetTitle: string
      plansTitle: string
    }
    keep: { title: (date: string) => string; body: (date: string) => string; cta: string }
    month: {
      kickerPro: string
      kickerTrial: string
      titleTimes: string
      titlePast: string
      titleInside: string
      subAll: string
      subSome: (n: number) => string
      subInside: string
      you: string
      freeStops: string
      answers: string
      receipts: string
      credits: string
      views: string
    }
    history: { title: string; proYearly: string; proMonthly: string; sparks: (n: number) => string; gift: string; fine: (store: string, company: string) => string }
  }
  usage: {
    freePlan: string
    pro: string
    trial: string
    pillPro: string
    pillFree: (pct: number) => string
    session: string
    week: string
    refillsAt: (time: string, credits: number) => string
    refillsOn: (day: string, credits: number) => string
    sparks: string
    sparksSub: string
    packs: { group: string; popular: string; plain: string; bonus: (n: number) => string; more: string; fewer: string; egypt: string }
    get: (n: number) => string
    withPro: (n: number) => string
    seePro: string
    packsFine: (pct: number) => string
    unavailable: string
    wentTitle: string
    features: { chat: string; receipt: string; budget: string; goals: string; other: string }
    sms: string
    never: string
    otherTitle: string
    views: string
    plans: string
    advisor: string
    unlimited: string
    included: string
    of: (used: number, limit: number) => string
    freeThisMonth: (n: number) => string
    removeLimits: string
  }
  rewards: {
    title: string
    flip: (tier: string) => string
    pts: string
    toNext: (points: string, name: string) => string
    topPro: string
    highest: string
    rank: (n: number) => string
    perksTitle: (name: string) => string
    member: (n: string) => string
    founder: (n: string) => string
    since: (date: string) => string
    lock: string
    tap: string
    streak: {
      title: (n: number) => string
      best: (n: number) => string
      pointsLabel: string
      strip: (range: string, kept: number, frozen: number, missed: number) => string
      /** The weeks the strip shows, counted from the week the user joined (week 1). */
      range: (from: number, to: number) => string
      nextBonus: (x: string) => string
      weeks: (n: number) => string
      topBonus: string
      freezes: (n: number) => string
    }
    tiersTitle: string
    pro: string
    here: string
    founderWord: string
    tiersFine: string
    badgeTitle: string
    placeProfile: string
    placeRow: string
    rowSub: (name: string, n: number) => string
    earnTitle: string
    earn: { week: string; weekHint: string; weekNow: (x: string) => string; budget: string; budgetHint: string; month: string }
    spendTitle: string
    shop: { repair: string; repairHint: string; freeze: string; finish: string; look: string }
    cost: (n: number) => string
    balance: (n: string) => string
    owned: string
    inUse: string
    spendFine: string
    confirm: { title: (item: string) => string; body: (cost: number, left: number) => string; cta: string; cancel: string }
    result: { ok: string; repairOk: string; freezeOk: string; insufficient: (need: number) => string; freezesFull: string; nothingToRepair: string; alreadyOwned: string; error: string }
    apply: { use: string; standard: string; done: string; fail: string }
    hubRow: string
    off: string
    loading: string
  }
  founders: {
    flip: (n: number) => string
    mark: string
    clubMark: string
    thanks: string
    backPerks: (number: string) => [string, string, string, string]
    joined: (date: string) => string
    forGood: string
    tap: string
    getTitle: string
    perks: { t: string; d: string }[]
    fine: string
    you: string
  }
  invite: {
    title: string
    pill: string
    heroGive: string
    heroGiveBold: string
    heroGet: string
    heroWeek: string
    heroSparks: string
    heroSub: (reward: string) => string
    rewardWeek: string
    rewardSparks: string
    pass: {
      flip: string
      mark: string
      title: string
      /** The signature under the title: "from Mohamed". */
      from: (first: string) => string
      sub: string
      code: string
      friendGets: string
      friendValue: string
      youGet: string
      youWeek: string
      youSparks: string
      backMark: string
      benefits: [string, string, string]
      codeLine: (code: string) => string
      noCharge: string
      tap: string
    }
    share: string
    copy: string
    copied: string
    shareText: (link: string) => string
    earned: { weeks: (n: number) => string; sparks: string; month: (used: number, cap: number) => string; startsLater: string; added: string; yearCap: string }
    friendsTitle: string
    friend: {
      unnamed: string
      joinedStuck: (date: string) => string
      joined: (date: string) => string
      active: (days: number, total: number, entries: number, entriesTotal: number) => string
      joinedNative: (date: string) => string
      heldNative: string
      heldReview: string
      plusWeek: string
      plusSparks: string
      onItsWay: string
      almost: string
      justJoined: string
      overCap: string
      didNotStick: string
      notCounted: string
    }
    none: string
    noneHint: string
    remind: (name: string) => string
    remindText: (link: string) => string
    howTitle: string
    steps: (reward: string) => [string, string, string]
    milestonesTitle: string
    ms: { friends: (n: number) => string; pts: (n: number) => string; connector: string; reached: string }
    fine: string
    cta: { title: string; titleSparks: string; sub: string; action: string }
    billingLine: string
    paused: string
    loadError: string
    tryAgain: string
  }
  /** The /i/<code> page a friend opens from an invite link. */
  landing: {
    title: (first: string) => string
    titleNoName: string
    sub: string
    flip: string
    youGet: string
    inviterGets: (first: string) => string
    inviterGetsNoName: string
    backMark: string
    benefits: [string, string, string]
    tap: string
    saved: string
    create: string
    signIn: string
    foot: string
  }
  profile: { proTag: string; free: string; trial: string; pro: string; founder: (n: string) => string }
  signup: { haveCode: string; label: string; placeholder: string; hint: string; saved: string; invalid: string }
  notice: { inviteLine: string; inviteAction: string }
}

const en: RewardsCopy = {
  tiers: {
    silver: { name: 'Silver', perks: ['Your badge after your name', 'Points and a streak for every real week', 'The points shop'], ladder: 'Everyone starts here. Your card, badge and streak.' },
    emerald: { name: 'Emerald', perks: ['A streak freeze every 4 weeks', '10 Sparks when you arrive', 'Everything in Silver'], ladder: 'A freeze every 4 kept weeks, and 10 Sparks when you arrive.' },
    diamond: { name: 'Diamond', perks: ['20% more Sparks in packs, with Pro', '20 Sparks when you arrive', 'Everything in Emerald'], ladder: 'With Pro, 20% more Sparks in every pack. 20 Sparks when you arrive.' },
    elite: { name: 'Elite', perks: ['The crimson card', 'Your Elite waits if Pro pauses', 'Everything in Diamond'], ladder: 'Pro members only. The crimson card and 30 Sparks.' },
    founder: { name: 'Elite Founder', perks: ['Your founder number on the card', 'A say in what we build', 'Everything in Elite'], ladder: 'Founders who reach Elite. The highest tier there is.' },
  },
  tierLabel: (name) => `${name} tier`,
  plan: {
    freePill: 'You’re on Free',
    showTitle: 'See what Pro adds to your money',
    showSub: 'Same app. More AI, the Advisor, and no limits.',
    colFree: 'Free',
    colPro: 'Pro',
    now: 'Now',
    rows: [
      { label: 'Buddgy and receipts', free: 'Limited', pro: 'About 10x more' },
      { label: 'Advisor', free: '1 a month', pro: 'Whenever you ask' },
      { label: 'Budget plans', free: '2', pro: 'Unlimited' },
      { label: 'View balance', free: '10 a month', pro: 'Unlimited' },
      { label: 'Sparks packs', free: 'Standard', pro: '+15% Sparks' },
    ],
    footnote: 'SMS tracking stays free on every account.',
    trialCta: 'Start 30 days free',
    trialFine: 'No card. On day 30 you move back to Free; nothing is charged.',
    trialUsed: 'This account has already had its 30 days of Pro.',
    trialFailed: 'Couldn’t start your 30 days. Nothing was changed. Try again.',
    orChoose: 'Or choose a plan now',
    yearly: 'Yearly',
    monthly: 'Monthly',
    bestValue: (pct) => `Best value · save ${pct}%`,
    perMonthBilledYearly: (price) => `${price} a month, billed yearly`,
    cancelAnyTime: 'Cancel any time',
    continueYearly: 'Continue with yearly',
    continueMonthly: 'Continue with monthly',
    storeFine: {
      ios: 'Billed through the App Store. Renews until you cancel in Settings → Apple Account.',
      android: 'Billed through Google Play. Renews until you cancel in Google Play → Subscriptions.',
    },
    restoreLink: 'Restore purchases',
    store: { ios: 'the App Store', android: 'Google Play' },
    notYet: 'Buying isn’t available on this device yet. Your plan stays as it is.',
    card: {
      flip: 'Your buddget Pro membership card. Tap to flip',
      markPro: 'PRO',
      markTrial: 'PRO TRIAL',
      lineTrial: '30-day trial · No card on file',
      linePro: (period, store) => `Pro ${period} · Billed by ${store}`,
      linePromo: 'buddget Pro · A gift from buddget',
      periodYearly: 'Yearly',
      periodMonthly: 'Monthly',
      memberSince: 'Member since',
      renews: 'Renews',
      trialEnds: 'Trial ends',
      until: 'Pro until',
      member: 'Member',
      includedMark: 'INCLUDED',
      included: (pct) => ['About 10x the AI', 'The Buddgy Advisor', 'Unlimited plans and View balance', `${pct}% more Sparks in every pack`],
      thenPrice: (price) => `Then ${price} / year, if you choose`,
      noCharge: 'No charge yet',
      perYear: (price) => `${price} / year`,
      perMonth: (price) => `${price} / month`,
      next: (date) => `Next ${date}`,
      ends: (date) => `Ends ${date}`,
      tap: 'Tap the card to view details',
    },
    manage: {
      group: 'Manage subscription',
      statusRenews: 'Renews {b}',
      statusUntil: 'Pro until {b}',
      statusTrial: 'Trial · {b}',
      noCard: 'no card on file',
      priceYr: (price) => `${price} / yr`,
      priceMo: (price) => `${price} / mo`,
      active: 'Active',
      dayOf: (day, total) => `Day ${day} of ${total}`,
      notRenewing: 'Not renewing',
      issue: 'Payment issue',
      changePlan: 'Change plan',
      choosePlan: 'Choose plan',
      manage: 'Manage',
      restore: 'Restore',
      receipts: 'Receipts',
      sheetTitle: 'Manage your plan',
      plansTitle: 'Choose a plan',
    },
    keep: {
      title: (date) => `Keep Pro after ${date}`,
      body: (date) => `On ${date} your account goes back to Free. Choose a plan and nothing changes.`,
      cta: 'Keep Pro',
    },
    month: {
      kickerPro: 'Pro this month',
      kickerTrial: 'So far with Pro',
      titleTimes: 'Pro went {b} further than Free would have',
      titlePast: 'Pro took you past Free’s limit this month',
      titleInside: 'You’re inside Free’s limits so far',
      subAll: 'You passed every Free limit, and nothing stopped you.',
      subSome: (n) => (n === 1 ? 'You passed a Free limit, and nothing stopped you.' : `You passed ${n} Free limits, and nothing stopped you.`),
      subInside: 'Pro’s room is there when you need it.',
      you: 'You',
      freeStops: 'Free stops at {b}',
      answers: 'Buddgy answers',
      receipts: 'Receipts scanned',
      credits: 'AI credits used',
      views: 'View balance',
    },
    history: {
      title: 'Billing history',
      proYearly: 'buddget Pro · Yearly',
      proMonthly: 'buddget Pro · Monthly',
      sparks: (n) => `${n} Sparks`,
      gift: 'From buddget',
      fine: (store, company) => `Payment and cancellation are handled by ${store}, as ${company} requires.`,
    },
  },
  usage: {
    freePlan: 'Free plan',
    pro: 'buddget Pro',
    trial: 'Pro trial',
    pillPro: 'About 10x the AI',
    pillFree: (pct) => `${pct}% of weekly limit`,
    session: '5-hour limit',
    week: 'Weekly limit',
    refillsAt: (time, credits) => `Refills at ${time} · ${credits} credits every 5 hours`,
    refillsOn: (day, credits) => `Refills ${day} · ${credits} credits a week`,
    sparks: 'Sparks',
    sparksSub: 'Used only after a limit. Sparks you buy never expire.',
    packs: { group: 'Sparks packs', popular: 'Most popular', plain: 'Sparks', bonus: (n) => `+${n} Pro bonus`, more: 'More packs', fewer: 'Fewer packs', egypt: 'Egypt' },
    get: (n) => `Get ${n} Sparks`,
    withPro: (n) => `With Pro, this pack is ${n} Sparks`,
    seePro: 'See Pro',
    packsFine: (pct) => `Pro adds ${pct}% to every pack. Your Pro and member bonuses never add together; you always get the bigger one.`,
    unavailable: 'Sparks packs can’t be bought on this device yet.',
    wentTitle: 'Where your weekly limit went',
    features: { chat: 'Buddgy chat and voice', receipt: 'Receipt scans', budget: 'AI budget', goals: 'Goal estimates', other: 'Other' },
    sms: 'SMS tracking',
    never: 'Never counts',
    otherTitle: 'Other limits',
    views: 'View balance',
    plans: 'Saved budget plans',
    advisor: 'Advisor answers',
    unlimited: 'Unlimited',
    included: 'Included',
    of: (used, limit) => `${used} of ${limit}`,
    freeThisMonth: (n) => `${n} free this month`,
    removeLimits: 'Remove these limits with Pro',
  },
  rewards: {
    title: 'Rewards',
    flip: (tier) => `Your buddget rewards card, ${tier} tier. Tap to see its perks`,
    pts: 'pts',
    toNext: (points, name) => `${points} pts to ${name}`,
    topPro: 'The top tier for Pro members',
    highest: 'The highest tier there is',
    rank: (n) => `Tier ${n} of 5`,
    perksTitle: (name) => `${name} perks`,
    member: (n) => `Member ${n}`,
    founder: (n) => `Founder ${n}`,
    since: (date) => `Since ${date}`,
    lock: 'Pro members only',
    tap: 'Tap the card to see its perks',
    streak: {
      title: () => '{b}-week streak',
      best: (n) => (n === 1 ? 'Your best is 1 week' : `Your best is ${n} weeks`),
      pointsLabel: 'points this streak',
      strip: (range, kept, frozen, missed) => `${range}: ${kept} kept, ${frozen} frozen, ${missed} missed`,
      range: (from, to) => (from === to ? `Week ${to} · since you joined` : from === 1 ? `Weeks 1–${to} · since you joined` : `Weeks ${from}–${to} · you joined in week 1`),
      nextBonus: (x) => `Next bonus at {b} · x${x}`,
      weeks: (n) => `${n} weeks`,
      topBonus: 'Your weeks earn {b} now',
      freezes: (n) => (n === 1 ? '{b} freeze left' : '{b} freezes left'),
    },
    tiersTitle: 'Tiers',
    pro: 'PRO',
    here: 'you’re here',
    founderWord: 'Founder',
    tiersFine: 'Elite is part of Pro. A founder who reaches Elite becomes Elite Founder.',
    badgeTitle: 'Your badge across buddget',
    placeProfile: 'Profile',
    placeRow: 'Settings row',
    rowSub: (name, n) => `${name} · tier ${n} of 5`,
    earnTitle: 'Earn points',
    earn: {
      week: 'Keep your week',
      weekHint: 'x1.5 from week 4, x2 from week 8',
      weekNow: (x) => `x${x} with your streak`,
      budget: 'Set your budget',
      budgetHint: 'Once a month',
      month: 'Track a full month',
    },
    spendTitle: 'Spend points',
    shop: { repair: 'Repair a missed week', repairHint: 'Within 48 hours, keeps your streak', freeze: 'A streak freeze', finish: 'A card finish', look: 'A Buddgy look' },
    cost: (n) => `${n} pts`,
    balance: (n) => `${n} points to spend`,
    owned: 'Owned',
    inUse: 'In use',
    spendFine: 'Spending points never lowers your tier. Tiers use the points you have earned in total.',
    confirm: {
      title: (item) => `${item}?`,
      body: (cost, left) => `This uses ${cost} points and leaves you ${left}. Your tier stays the same.`,
      cta: 'Use points',
      cancel: 'Not now',
    },
    result: {
      ok: 'Done. It’s yours.',
      repairOk: 'Your streak is repaired.',
      freezeOk: 'A freeze is added.',
      insufficient: (need) => `You need ${need} more points for this.`,
      freezesFull: 'You already hold 2 freezes, the most you can keep.',
      nothingToRepair: 'There’s no missed week to repair right now.',
      alreadyOwned: 'You already own this.',
      error: 'Couldn’t use your points. Nothing was changed. Try again.',
    },
    apply: { use: 'Use it', standard: 'Back to standard', done: 'Done.', fail: 'Couldn’t change it. Try again.' },
    hubRow: 'Rewards',
    off: 'Rewards are resting for now. Your points are safe.',
    loading: 'Loading your rewards…',
  },
  founders: {
    flip: (n) => `Your founder card, number ${n}. Tap to flip`,
    mark: 'FOUNDER',
    clubMark: 'FOUNDERS CLUB',
    thanks: 'With thanks for building buddget with us from the very first weeks.',
    backPerks: (number) => [`Founder ${number} of at most 100`, 'Your name on the credits, if you want it', 'Asked first when we test something new', 'Elite Founder when you reach Elite'],
    joined: (date) => `Joined ${date}`,
    forGood: 'Yours for good',
    tap: 'Tap the card to flip it',
    getTitle: 'What founders get',
    perks: [
      { t: 'Your number', d: 'A founder number that stays yours.' },
      { t: 'Your name on the credits', d: 'If you want it. We approve each name first.' },
      { t: 'A say in what we build', d: 'Founders are asked first when we test something new.' },
      { t: 'Elite Founder', d: 'Reach Elite on Pro and your tier becomes Elite Founder.' },
    ],
    fine: 'At most 100 founders. The window closes 60 days after launch.',
    you: 'you',
  },
  invite: {
    title: 'Invite friends',
    pill: 'Free for both of you',
    heroGive: 'Give {b}.',
    heroGiveBold: '37 Days of Pro',
    heroGet: 'Get {b} each time.',
    heroWeek: 'a week',
    heroSparks: '500 Sparks',
    heroSub: (reward) => `Your friend gets 37 days of Pro on a new account. You get ${reward} when they stick with buddget.`,
    rewardWeek: 'a week of Pro',
    rewardSparks: '500 Sparks',
    pass: {
      flip: 'Your invite pass. Tap to flip',
      mark: 'GUEST PASS',
      title: '37 Days of Pro',
      from: (first) => `from ${first}`,
      sub: 'No card needed · for new accounts',
      code: 'Invite code',
      friendGets: 'Friend gets',
      friendValue: '30 + 7 DAYS',
      youGet: 'You get',
      youWeek: '1 WEEK',
      youSparks: '500 SPARKS',
      backMark: 'WHAT THEY GET',
      benefits: ['Bank texts tracked automatically', 'About 10x the AI, and the Advisor', '37 days free, then Free or Pro: their choice'],
      codeLine: (code) => `Code ${code}`,
      noCharge: 'No card, no charge',
      tap: 'Tap the pass to see what your friend gets',
    },
    share: 'Share your invite',
    copy: 'Copy link',
    copied: 'Copied',
    shareText: (link) => `Join me on buddget and get 37 days of Pro, no card needed. ${link}`,
    earned: {
      weeks: (n) => (n === 1 ? '{b} week of Pro earned' : '{b} weeks of Pro earned'),
      sparks: '{b} Sparks earned',
      month: (used, cap) => `${used} of ${cap} this month`,
      startsLater: 'Starts when your trial or Pro time ends',
      added: 'Added to your Sparks',
      yearCap: 'Up to {b} a year',
    },
    friendsTitle: 'Your friends',
    friend: {
      unnamed: 'A friend',
      joinedStuck: (date) => `Joined ${date} · stuck with it`,
      joined: (date) => `Joined ${date}`,
      active: (days, total, entries, entriesTotal) => `Active ${days} of ${total} days · ${entries} of ${entriesTotal} entries`,
      joinedNative: (date) => `Joined ${date} · counts once they sign in on a phone`,
      heldNative: 'Waiting for a phone sign-in',
      heldReview: 'Being checked',
      plusWeek: '+1 week',
      plusSparks: '+500 Sparks',
      onItsWay: 'On its way',
      almost: 'Almost there',
      justJoined: 'Just joined',
      overCap: 'Past this month’s limit',
      didNotStick: 'Didn’t stick',
      notCounted: 'Not counted',
    },
    none: 'No friends yet',
    noneHint: 'Share your link and they show up here.',
    remind: (name) => `Remind ${name}`,
    remindText: (link) => `A few more days on buddget and your 37 days of Pro are well used. Open it here: ${link}`,
    howTitle: 'How it works',
    steps: (reward) => ['Share your link or code', 'Your friend makes a new account and gets 37 days of Pro, no card', `In their first 14 days they use buddget on 3 days and log 5 entries: you get ${reward}`],
    milestonesTitle: 'Invite milestones',
    ms: { friends: (n) => `${n} friends`, pts: (n) => `+${n} pts`, connector: 'The Connector card finish', reached: 'Reached' },
    fine: 'Up to 4 rewards a month and 12 a year. For new accounts only, made in the last 7 days. A friend who joins on the web counts once they sign in on a phone.',
    cta: { title: 'Give 37 days of Pro, get a week', titleSparks: 'Give 37 days of Pro, get 500 Sparks', sub: 'For every friend who sticks with buddget', action: 'Invite ›' },
    billingLine: 'Not ready to pay? Invite a friend and keep Pro another week',
    paused: 'Invites are paused for now. What you have earned stays yours.',
    loadError: 'Couldn’t load your invites. Try again.',
    tryAgain: 'Try again',
  },
  landing: {
    title: (first) => `${first} sent you a guest pass`,
    titleNoName: 'You’ve got a guest pass',
    sub: '37 Days of Pro on a new account. No card needed.',
    flip: 'Your guest pass. Tap to flip',
    youGet: 'You get',
    inviterGets: (first) => `${first} gets`,
    inviterGetsNoName: 'Your friend gets',
    backMark: 'WHAT YOU GET',
    benefits: ['Bank texts tracked automatically', 'About 10x the AI, and the Advisor', '37 days free, then Free or Pro: your choice'],
    tap: 'Tap the pass to see what you get',
    saved: 'Code saved for sign-up',
    create: 'Create your account',
    signIn: 'I already have buddget',
    foot: 'Works on iPhone, Android and the web. A friend who joins on the web counts once they sign in on a phone.',
  },
  profile: { proTag: 'PRO', free: 'Free', trial: 'Pro trial', pro: 'buddget Pro', founder: (n) => `Founder ${n}` },
  signup: {
    haveCode: 'Have an invite code?',
    label: 'Invite code',
    placeholder: 'NOUR-7K2',
    hint: 'A friend’s code gives you 37 days of Pro, no card, for new accounts.',
    saved: 'Code saved. It applies when your account is ready.',
    invalid: 'That code doesn’t look right. Check it and try again.',
  },
  notice: { inviteLine: 'Not ready to pay? Invite a friend and keep Pro another week.', inviteAction: 'Invite a friend' },
}

const ar: RewardsCopy = {
  tiers: {
    silver: { name: 'الفضي', perks: ['شارتك بعد اسمك', 'نقاط وسلسلة لكل أسبوع حقيقي', 'متجر النقاط'], ladder: 'الجميع يبدأ من هنا. بطاقتك وشارتك وسلسلتك.' },
    emerald: { name: 'الزمردي', perks: ['تجميد للسلسلة كل 4 أسابيع', '10 سبارك عند الوصول', 'كل ما في الفضي'], ladder: 'تجميد كل 4 أسابيع محفوظة، و10 سبارك عند الوصول.' },
    diamond: { name: 'الماسي', perks: ['20% سبارك إضافية في الباقات مع برو', '20 سبارك عند الوصول', 'كل ما في الزمردي'], ladder: 'مع برو، 20% سبارك إضافية في كل باقة. و20 سبارك عند الوصول.' },
    elite: { name: 'النخبة', perks: ['البطاقة القرمزية', 'مستوى النخبة ينتظرك إن توقف برو', 'كل ما في الماسي'], ladder: 'لأعضاء برو فقط. البطاقة القرمزية و30 سبارك.' },
    founder: { name: 'نخبة المؤسسين', perks: ['رقمك كمؤسس على البطاقة', 'رأي فيما نبنيه', 'كل ما في النخبة'], ladder: 'المؤسسون الذين يبلغون النخبة. أعلى مستوى على الإطلاق.' },
  },
  tierLabel: (name) => `المستوى ${name}`,
  plan: {
    freePill: 'أنت على المجاني',
    showTitle: 'شاهد ما يضيفه برو لأموالك',
    showSub: 'التطبيق نفسه. ذكاء اصطناعي أكثر، والمساعد، وبلا حدود.',
    colFree: 'المجاني',
    colPro: 'برو',
    now: 'الآن',
    rows: [
      { label: 'بادجي والإيصالات', free: 'محدود', pro: 'حوالي 10 أضعاف' },
      { label: 'المساعد', free: 'مرة في الشهر', pro: 'متى سألت' },
      { label: 'خطط الميزانية', free: '2', pro: 'بلا حد' },
      { label: 'عرض الرصيد', free: '10 في الشهر', pro: 'بلا حد' },
      { label: 'باقات سبارك', free: 'عادية', pro: '+15% سبارك' },
    ],
    footnote: 'تتبّع الرسائل النصية يبقى مجانياً لكل حساب.',
    trialCta: 'ابدأ 30 يوماً مجاناً',
    trialFine: 'بلا بطاقة. في اليوم 30 تعود إلى المجاني؛ لن يُخصم شيء.',
    trialUsed: 'هذا الحساب استخدم أيام برو الثلاثين من قبل.',
    trialFailed: 'تعذّر بدء أيامك الثلاثين. لم يتغير شيء. حاول مرة أخرى.',
    orChoose: 'أو اختر خطة الآن',
    yearly: 'سنوي',
    monthly: 'شهري',
    bestValue: (pct) => `أفضل قيمة · وفّر ${pct}%`,
    perMonthBilledYearly: (price) => `${price} في الشهر، تُدفع سنوياً`,
    cancelAnyTime: 'ألغِ في أي وقت',
    continueYearly: 'تابع بالسنوي',
    continueMonthly: 'تابع بالشهري',
    storeFine: {
      ios: 'الدفع عبر App Store. يتجدد حتى تلغيه من الإعدادات ← حساب Apple.',
      android: 'الدفع عبر Google Play. يتجدد حتى تلغيه من Google Play ← الاشتراكات.',
    },
    restoreLink: 'استعادة المشتريات',
    store: { ios: 'App Store', android: 'Google Play' },
    notYet: 'الشراء غير متاح على هذا الجهاز بعد. خطتك تبقى كما هي.',
    card: {
      flip: 'بطاقة عضويتك في بادجت برو. اضغط لقلبها',
      markPro: 'PRO',
      markTrial: 'PRO TRIAL',
      lineTrial: 'تجربة 30 يوماً · بلا بطاقة مسجلة',
      linePro: (period, store) => `برو ${period} · الدفع عبر ${store}`,
      linePromo: 'بادجت برو · هدية من بادجت',
      periodYearly: 'السنوي',
      periodMonthly: 'الشهري',
      memberSince: 'عضو منذ',
      renews: 'يتجدد',
      trialEnds: 'تنتهي التجربة',
      until: 'برو حتى',
      member: 'العضو',
      includedMark: 'INCLUDED',
      included: (pct) => ['حوالي 10 أضعاف الذكاء الاصطناعي', 'مساعد بادجي', 'خطط وعرض رصيد بلا حد', `${pct}% سبارك إضافية في كل باقة`],
      thenPrice: (price) => `ثم ${price} في السنة، إن اخترت`,
      noCharge: 'لا خصم بعد',
      perYear: (price) => `${price} في السنة`,
      perMonth: (price) => `${price} في الشهر`,
      next: (date) => `التالي ${date}`,
      ends: (date) => `ينتهي ${date}`,
      tap: 'اضغط على البطاقة لعرض التفاصيل',
    },
    manage: {
      group: 'إدارة الاشتراك',
      statusRenews: 'يتجدد {b}',
      statusUntil: 'برو حتى {b}',
      statusTrial: 'تجربة · {b}',
      noCard: 'بلا بطاقة مسجلة',
      priceYr: (price) => `${price} في السنة`,
      priceMo: (price) => `${price} في الشهر`,
      active: 'نشط',
      dayOf: (day, total) => `اليوم ${day} من ${total}`,
      notRenewing: 'لن يتجدد',
      issue: 'مشكلة في الدفع',
      changePlan: 'غيّر الخطة',
      choosePlan: 'اختر خطة',
      manage: 'إدارة',
      restore: 'استعادة',
      receipts: 'الإيصالات',
      sheetTitle: 'أدِر خطتك',
      plansTitle: 'اختر خطة',
    },
    keep: {
      title: (date) => `احتفظ ببرو بعد ${date}`,
      body: (date) => `في ${date} يعود حسابك إلى المجاني. اختر خطة ولن يتغير شيء.`,
      cta: 'احتفظ ببرو',
    },
    month: {
      kickerPro: 'برو هذا الشهر',
      kickerTrial: 'حتى الآن مع برو',
      titleTimes: 'برو ذهب بك {b} أبعد مما كان سيصل إليه المجاني',
      titlePast: 'برو تجاوز بك حد المجاني هذا الشهر',
      titleInside: 'أنت ضمن حدود المجاني حتى الآن',
      subAll: 'تجاوزت كل حدود المجاني ولم يوقفك شيء.',
      subSome: (n) => (n === 1 ? 'تجاوزت حداً من حدود المجاني ولم يوقفك شيء.' : n === 2 ? 'تجاوزت حدّين من حدود المجاني ولم يوقفك شيء.' : `تجاوزت ${n} من حدود المجاني ولم يوقفك شيء.`),
      subInside: 'مساحة برو موجودة حين تحتاجها.',
      you: 'أنت',
      freeStops: 'المجاني يتوقف عند {b}',
      answers: 'إجابات بادجي',
      receipts: 'إيصالات ممسوحة',
      credits: 'رصيد الذكاء الاصطناعي المستخدم',
      views: 'عرض الرصيد',
    },
    history: {
      title: 'سجل الفوترة',
      proYearly: 'بادجت برو · سنوي',
      proMonthly: 'بادجت برو · شهري',
      sparks: (n) => `${n} سبارك`,
      gift: 'من بادجت',
      fine: (store, company) => `الدفع والإلغاء يتمان عبر ${store}، كما تشترط ${company}.`,
    },
  },
  usage: {
    freePlan: 'الخطة المجانية',
    pro: 'بادجت برو',
    trial: 'تجربة برو',
    pillPro: 'حوالي 10 أضعاف الذكاء الاصطناعي',
    pillFree: (pct) => `${pct}% من الحد الأسبوعي`,
    session: 'حد الخمس ساعات',
    week: 'الحد الأسبوعي',
    refillsAt: (time, credits) => `يتجدد الساعة ${time} · ${credits} رصيداً كل 5 ساعات`,
    refillsOn: (day, credits) => `يتجدد ${day} · ${credits} رصيداً في الأسبوع`,
    sparks: 'سبارك',
    sparksSub: 'تُستخدم فقط بعد بلوغ الحد. ما تشتريه من سبارك لا تنتهي صلاحيته.',
    packs: { group: 'باقات سبارك', popular: 'الأكثر طلباً', plain: 'سبارك', bonus: (n) => `+${n} إضافة برو`, more: 'باقات أخرى', fewer: 'باقات أقل', egypt: 'مصر' },
    get: (n) => `احصل على ${n} سبارك`,
    withPro: (n) => `مع برو، هذه الباقة ${n} سبارك`,
    seePro: 'شاهد برو',
    packsFine: (pct) => `برو يضيف ${pct}% إلى كل باقة. إضافة برو وإضافة العضوية لا تُجمعان؛ تحصل دائماً على الأكبر.`,
    unavailable: 'لا يمكن شراء باقات سبارك على هذا الجهاز بعد.',
    wentTitle: 'أين ذهب حدك الأسبوعي',
    features: { chat: 'محادثة بادجي والصوت', receipt: 'مسح الإيصالات', budget: 'الميزانية بالذكاء الاصطناعي', goals: 'تقديرات الأهداف', other: 'أخرى' },
    sms: 'تتبّع الرسائل النصية',
    never: 'لا يُحتسب',
    otherTitle: 'حدود أخرى',
    views: 'عرض الرصيد',
    plans: 'خطط الميزانية المحفوظة',
    advisor: 'إجابات المساعد',
    unlimited: 'بلا حد',
    included: 'مضمّن',
    of: (used, limit) => `${used} من ${limit}`,
    freeThisMonth: (n) => `${n} مجاناً هذا الشهر`,
    removeLimits: 'أزل هذه الحدود مع برو',
  },
  rewards: {
    title: 'المكافآت',
    flip: (tier) => `بطاقة مكافآتك في بادجت، المستوى ${tier}. اضغط لعرض مزاياها`,
    pts: 'نقطة',
    toNext: (points, name) => `${points} نقطة إلى ${name}`,
    topPro: 'أعلى مستوى لأعضاء برو',
    highest: 'أعلى مستوى على الإطلاق',
    rank: (n) => `المستوى ${n} من 5`,
    perksTitle: (name) => `مزايا ${name}`,
    member: (n) => `العضو ${n}`,
    founder: (n) => `المؤسس رقم ${String(n).replace('#', '')}`,
    since: (date) => `منذ ${date}`,
    lock: 'لأعضاء برو فقط',
    tap: 'اضغط على البطاقة لعرض مزاياها',
    streak: {
      title: (n) => (n === 1 ? 'سلسلة من أسبوع {b}' : n === 2 ? 'سلسلة من {b} أسبوعين' : n <= 10 ? 'سلسلة من {b} أسابيع' : 'سلسلة من {b} أسبوعاً'),
      best: (n) => (n === 1 ? 'أفضل سلسلة لك أسبوع واحد' : n === 2 ? 'أفضل سلسلة لك أسبوعان' : n <= 10 ? `أفضل سلسلة لك ${n} أسابيع` : `أفضل سلسلة لك ${n} أسبوعاً`),
      pointsLabel: 'نقاط هذه السلسلة',
      strip: (range, kept, frozen, missed) => `${range}: ${kept} محفوظة، ${frozen} مجمّدة، ${missed} فائتة`,
      range: (from, to) => (from === to ? `الأسبوع ${to} · منذ انضمامك` : from === 1 ? `الأسابيع 1–${to} · منذ انضمامك` : `الأسابيع ${from}–${to} · انضممت في الأسبوع 1`),
      nextBonus: (x) => `المضاعفة التالية عند {b} · x${x}`,
      weeks: (n) => (n <= 10 ? `${n} أسابيع` : `${n} أسبوعاً`),
      topBonus: 'أسابيعك تكسب {b} الآن',
      freezes: (n) => (n === 1 ? 'تجميد {b} متبقٍّ' : 'تجميدات متبقية: {b}'),
    },
    tiersTitle: 'المستويات',
    pro: 'PRO',
    here: 'أنت هنا',
    founderWord: 'مؤسس',
    tiersFine: 'النخبة جزء من برو. المؤسس الذي يبلغ النخبة يصبح من نخبة المؤسسين.',
    badgeTitle: 'شارتك في أنحاء بادجت',
    placeProfile: 'الملف الشخصي',
    placeRow: 'صف الإعدادات',
    rowSub: (name, n) => `${name} · المستوى ${n} من 5`,
    earnTitle: 'اكسب النقاط',
    earn: {
      week: 'احفظ أسبوعك',
      weekHint: 'x1.5 من الأسبوع 4، و x2 من الأسبوع 8',
      weekNow: (x) => `x${x} مع سلسلتك`,
      budget: 'ضع ميزانيتك',
      budgetHint: 'مرة في الشهر',
      month: 'تتبّع شهراً كاملاً',
    },
    spendTitle: 'أنفق النقاط',
    shop: { repair: 'إصلاح أسبوع فائت', repairHint: 'خلال 48 ساعة، ويحفظ سلسلتك', freeze: 'تجميد للسلسلة', finish: 'تشطيب للبطاقة', look: 'مظهر لبادجي' },
    cost: (n) => `${n} نقطة`,
    balance: (n) => `${n} نقطة للإنفاق`,
    owned: 'تملكه',
    inUse: 'مستخدم',
    spendFine: 'إنفاق النقاط لا يخفض مستواك أبداً. المستويات تعتمد على مجموع ما كسبته من نقاط.',
    confirm: {
      title: (item) => `${item}؟`,
      body: (cost, left) => `يستخدم هذا ${cost} نقطة ويبقى لك ${left}. مستواك لا يتغير.`,
      cta: 'استخدم النقاط',
      cancel: 'ليس الآن',
    },
    result: {
      ok: 'تم. أصبح لك.',
      repairOk: 'تم إصلاح سلسلتك.',
      freezeOk: 'أُضيف تجميد.',
      insufficient: (need) => `تحتاج ${need} نقطة إضافية لهذا.`,
      freezesFull: 'لديك تجميدان بالفعل، وهو أقصى ما يمكن الاحتفاظ به.',
      nothingToRepair: 'لا يوجد أسبوع فائت لإصلاحه الآن.',
      alreadyOwned: 'أنت تملك هذا بالفعل.',
      error: 'تعذّر استخدام نقاطك. لم يتغير شيء. حاول مرة أخرى.',
    },
    apply: { use: 'استخدمه', standard: 'عُد إلى الأساسي', done: 'تم.', fail: 'تعذّر التغيير. حاول مرة أخرى.' },
    hubRow: 'المكافآت',
    off: 'المكافآت متوقفة مؤقتاً. نقاطك محفوظة.',
    loading: 'جارٍ تحميل مكافآتك…',
  },
  founders: {
    flip: (n) => `بطاقة المؤسس، رقم ${n}. اضغط لقلبها`,
    mark: 'FOUNDER',
    clubMark: 'FOUNDERS CLUB',
    thanks: 'شكراً لأنك بنيت بادجت معنا منذ أسابيعه الأولى.',
    backPerks: (number) => [`المؤسس ${number} من 100 كحد أقصى`, 'اسمك في قائمة الشكر، إن أردت', 'نسألك أولاً عند اختبار أي جديد', 'نخبة المؤسسين عند بلوغ النخبة'],
    joined: (date) => `انضم ${date}`,
    forGood: 'لك دائماً',
    tap: 'اضغط على البطاقة لقلبها',
    getTitle: 'ما يحصل عليه المؤسسون',
    perks: [
      { t: 'رقمك', d: 'رقم مؤسس يبقى لك.' },
      { t: 'اسمك في قائمة الشكر', d: 'إن أردت. نراجع كل اسم أولاً.' },
      { t: 'رأي فيما نبنيه', d: 'نسأل المؤسسين أولاً عند اختبار أي جديد.' },
      { t: 'نخبة المؤسسين', d: 'ابلغ النخبة مع برو ويصبح مستواك نخبة المؤسسين.' },
    ],
    fine: 'حتى 100 مؤسس كحد أقصى. تُغلق المهلة بعد 60 يوماً من الإطلاق.',
    you: 'أنت',
  },
  invite: {
    title: 'ادعُ أصدقاءك',
    pill: 'مجاناً لكما',
    heroGive: 'أهدِ {b}.',
    heroGiveBold: '37 يوماً من برو',
    heroGet: 'واحصل على {b} في كل مرة.',
    heroWeek: 'أسبوع',
    heroSparks: '500 سبارك',
    heroSub: (reward) => `يحصل صديقك على 37 يوماً من برو على حساب جديد. وتحصل أنت على ${reward} حين يستمر مع بادجت.`,
    rewardWeek: 'أسبوع من برو',
    rewardSparks: '500 سبارك',
    pass: {
      flip: 'بطاقة دعوتك. اضغط لقلبها',
      mark: 'بطاقة ضيف',
      title: '37 يوماً من برو',
      from: (first) => `من ${first}`,
      sub: 'بلا بطاقة · للحسابات الجديدة',
      code: 'رمز الدعوة',
      friendGets: 'للصديق',
      friendValue: '30 + 7 أيام',
      youGet: 'لك',
      youWeek: 'أسبوع',
      youSparks: '500 سبارك',
      backMark: 'ما يحصل عليه صديقك',
      benefits: ['تتبّع رسائل البنك تلقائياً', 'حوالي 10 أضعاف الذكاء الاصطناعي، والمساعد', '37 يوماً مجاناً، ثم المجاني أو برو: الخيار لهم'],
      codeLine: (code) => `الرمز ${code}`,
      noCharge: 'بلا بطاقة، بلا خصم',
      tap: 'اضغط على البطاقة لترى ما يحصل عليه صديقك',
    },
    share: 'شارك دعوتك',
    copy: 'انسخ الرابط',
    copied: 'تم النسخ',
    shareText: (link) => `انضم إليّ على بادجت واحصل على 37 يوماً من برو بلا بطاقة. ${link}`,
    earned: {
      weeks: (n) => (n === 1 ? 'كسبت أسبوعاً {b} من برو' : n === 2 ? 'كسبت {b} أسبوعين من برو' : n <= 10 ? 'كسبت {b} أسابيع من برو' : 'كسبت {b} أسبوعاً من برو'),
      sparks: 'كسبت {b} سبارك',
      month: (used, cap) => `${used} من ${cap} هذا الشهر`,
      startsLater: 'يبدأ عند انتهاء تجربتك أو وقت برو',
      added: 'أُضيفت إلى رصيدك من سبارك',
      yearCap: 'حتى {b} في السنة',
    },
    friendsTitle: 'أصدقاؤك',
    friend: {
      unnamed: 'صديق',
      joinedStuck: (date) => `انضم ${date} · واستمر`,
      joined: (date) => `انضم ${date}`,
      active: (days, total, entries, entriesTotal) => `نشط ${days} من ${total} أيام · ${entries} من ${entriesTotal} إدخالات`,
      joinedNative: (date) => `انضم ${date} · يُحتسب بعد تسجيل الدخول من هاتف`,
      heldNative: 'بانتظار تسجيل الدخول من هاتف',
      heldReview: 'قيد المراجعة',
      plusWeek: '+أسبوع',
      plusSparks: '+500 سبارك',
      onItsWay: 'في الطريق',
      almost: 'اقترب',
      justJoined: 'انضم للتو',
      overCap: 'تجاوز حد هذا الشهر',
      didNotStick: 'لم يستمر',
      notCounted: 'لم يُحتسب',
    },
    none: 'لا أصدقاء بعد',
    noneHint: 'شارك رابطك وسيظهرون هنا.',
    remind: (name) => `ذكّر ${name}`,
    remindText: (link) => `أيام قليلة أخرى على بادجت وتستفيد من أيام برو الـ 37 كاملة. افتحه من هنا: ${link}`,
    howTitle: 'كيف تعمل',
    steps: (reward) => ['شارك رابطك أو رمزك', 'ينشئ صديقك حساباً جديداً ويحصل على 37 يوماً من برو بلا بطاقة', `خلال أول 14 يوماً يستخدم بادجت في 3 أيام ويسجل 5 إدخالات: تحصل على ${reward}`],
    milestonesTitle: 'محطات الدعوات',
    ms: { friends: (n) => (n <= 10 ? `${n} أصدقاء` : `${n} صديقاً`), pts: (n) => `+${n} نقطة`, connector: 'تشطيب البطاقة Connector', reached: 'تحقق' },
    fine: 'حتى 4 مكافآت في الشهر و12 في السنة. للحسابات الجديدة فقط، المُنشأة خلال آخر 7 أيام. الصديق الذي ينضم من الويب يُحتسب بعد تسجيل دخوله من هاتف.',
    cta: { title: 'أهدِ 37 يوماً من برو واحصل على أسبوع', titleSparks: 'أهدِ 37 يوماً من برو واحصل على 500 سبارك', sub: 'عن كل صديق يستمر مع بادجت', action: 'ادعُ ‹' },
    billingLine: 'لست مستعداً للدفع؟ ادعُ صديقاً واحتفظ ببرو أسبوعاً آخر',
    paused: 'الدعوات متوقفة مؤقتاً. ما كسبته يبقى لك.',
    loadError: 'تعذّر تحميل دعواتك. حاول مرة أخرى.',
    tryAgain: 'حاول مرة أخرى',
  },
  landing: {
    title: (first) => `أرسل لك ${first} بطاقة ضيف`,
    titleNoName: 'وصلتك بطاقة ضيف',
    sub: '37 يوماً من برو على حساب جديد. بلا بطاقة.',
    flip: 'بطاقة الضيف. اضغط لقلبها',
    youGet: 'لك',
    inviterGets: (first) => `لـ ${first}`,
    inviterGetsNoName: 'لصديقك',
    backMark: 'ما تحصل عليه',
    benefits: ['تتبّع رسائل البنك تلقائياً', 'حوالي 10 أضعاف الذكاء الاصطناعي، والمساعد', '37 يوماً مجاناً، ثم المجاني أو برو: الخيار لك'],
    tap: 'اضغط على البطاقة لترى ما تحصل عليه',
    saved: 'حُفظ الرمز للتسجيل',
    create: 'أنشئ حسابك',
    signIn: 'لدي بادجت بالفعل',
    foot: 'يعمل على iPhone وAndroid والويب. الصديق الذي ينضم من الويب يُحتسب بعد تسجيل دخوله من هاتف.',
  },
  profile: { proTag: 'PRO', free: 'المجاني', trial: 'تجربة برو', pro: 'بادجت برو', founder: (n) => `المؤسس رقم ${String(n).replace('#', '')}` },
  signup: {
    haveCode: 'لديك رمز دعوة؟',
    label: 'رمز الدعوة',
    placeholder: 'NOUR-7K2',
    hint: 'رمز صديقك يمنحك 37 يوماً من برو بلا بطاقة، للحسابات الجديدة.',
    saved: 'حُفظ الرمز. يُطبَّق عند جاهزية حسابك.',
    invalid: 'هذا الرمز لا يبدو صحيحاً. تحقق منه وحاول مرة أخرى.',
  },
  notice: { inviteLine: 'لست مستعداً للدفع؟ ادعُ صديقاً واحتفظ ببرو أسبوعاً آخر.', inviteAction: 'ادعُ صديقاً' },
}

export const rewardsCopy: Record<Locale, RewardsCopy> = { en, ar }

export function useRewardsCopy(): RewardsCopy {
  const { locale } = useLocale()
  return rewardsCopy[locale]
}
