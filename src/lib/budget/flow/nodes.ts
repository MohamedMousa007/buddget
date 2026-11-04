import { debtCount, essentialsEstimate, get, goalMonthlyNeed, has, hasAnyGoal, highAprDebt, housingMonthly, is, monthsHeld, num, planIncome, slack, stability } from './derive'
import type { FlowControl, FlowModule, FlowNode, FlowState } from './types'

type Rest = Partial<Omit<FlowNode, 'id' | 'mod' | 'control' | 'q' | 'why'>>
const n = (id: string, mod: FlowModule, control: FlowControl, q: string, why: string, rest: Rest = {}): FlowNode => ({
  id, mod, control, q, why, stake: 0.2, tier: 'std', ...rest,
})
const follow = (id: string, mod: FlowModule, control: FlowControl, q: string, why: string, when: (s: FlowState) => boolean, rest: Rest = {}) =>
  n(id, mod, control, q, why, { tier: 'follow', stake: 0.3, when, ...rest })

const isDebtor = (s: FlowState) => (s.intent === 'debt' && num(s, 'knownDebtCount') === 0) || is(s, 'hasDebts', true) || is(s, 'moreDebts', true)
const kind = (s: FlowState, k: string) => isDebtor(s) && has(s, 'debtKinds', k)
const rents = (s: FlowState) => is(s, 'housing', 'rent')
const partnered = (s: FlowState) => is(s, 'household', 'couple') || is(s, 'household', 'family')
const wantsGoal = (s: FlowState) => s.intent === 'goal' || is(s, 'hasGoal', true)
const car = (s: FlowState) => is(s, 'transportMode', 'car')

/** Every question the budget flow can ask. Which ones a person sees depends on intent, what the app knows, and earlier answers. */
const ALL: readonly FlowNode[] = [
  // ---- income
  n('confirmIncome', 'found', 'confirm', 'Your income is about {income} a month. Right?', 'Every line is sized against this number.', { tier: 'core', stake: 1, when: (s) => s.known.income !== undefined }),
  n('income', 'income', 'amount', 'What do you take home in a normal month?', 'Every line is sized against this number.', { tier: 'core', stake: 1 }),
  n('incomeType', 'income', 'chips', 'How do you earn it?', 'Decides how steady the plan can be.', { tier: 'core', stake: 0.6, opts: ['salary', 'freelance', 'business', 'seasonal', 'mixed', 'benefits', 'allowance'] }),
  follow('incomeStability', 'income', 'chips', 'Does your pay change month to month?', 'A fixed salary and a changing one are planned differently.', (s) => is(s, 'incomeType', 'salary'), { opts: ['fixed', 'variable', 'mixed'], stake: 0.5 }),
  follow('jobSecurity', 'income', 'chips', 'How secure does your job feel?', 'An uncertain job needs a bigger safety net.', (s) => is(s, 'incomeType', 'salary'), { opts: ['secure', 'uncertain', 'expecting_change'], stake: 0.3, tier: 'std' }),
  follow('lowMonth', 'income', 'amount', 'What do you earn in a slow month?', 'The plan is sized on your slow month so it never breaks.', (s) => stability(s) !== 'fixed', { stake: 0.4, skippable: true }),
  follow('taxSetAside', 'income', 'chips', 'Do you set money aside for taxes?', 'Untaxed income is not all yours to spend.', (s) => ['freelance', 'business', 'mixed', 'seasonal'].includes(String(get(s, 'incomeType'))), { opts: ['already', 'not_yet', 'not_needed'], stake: 0.3 }),
  follow('taxPct', 'income', 'stepper', 'What share should we set aside?', 'We hold it back before anything else.', (s) => is(s, 'taxSetAside', 'not_yet'), { min: 5, max: 40, stake: 0.25, skippable: true }),
  follow('payFrequency', 'income', 'chips', 'How often are you paid?', 'Sets when money arrives and how bills line up.', (s) => ['salary', 'benefits', 'allowance'].includes(String(get(s, 'incomeType'))), { opts: ['monthly', 'biweekly', 'weekly'], stake: 0.2 }),
  follow('payday', 'income', 'stepper', 'Which day of the month?', 'The month in your plan starts on payday.', (s) => ['salary', 'benefits', 'allowance'].includes(String(get(s, 'incomeType'))) && !is(s, 'payFrequency', 'weekly') && !is(s, 'payFrequency', 'biweekly'), { min: 1, max: 31, stake: 0.2 }),

  // ---- housing
  n('housing', 'housing', 'chips', 'Where do you live?', 'Housing is usually the biggest line.', { tier: 'core', stake: 0.8, opts: ['rent', 'own', 'family', 'company'] }),
  follow('ownType', 'housing', 'chips', 'Do you still pay a mortgage?', 'A mortgage is a fixed cost and a debt.', (s) => is(s, 'housing', 'own'), { opts: ['mortgage', 'paid_off'], stake: 0.6 }),
  follow('rent', 'housing', 'amount', 'How much is your rent?', 'The biggest fixed line in most plans.', rents, { stake: 0.7 }),
  follow('rentFreq', 'housing', 'chips', 'How often do you pay it?', 'Rent paid every quarter or year is spread across the months.', (s) => rents(s) && num(s, 'rent') > 0, { opts: ['monthly', 'quarterly', 'yearly'], stake: 0.35 }),
  follow('rentCheck', 'housing', 'chips', 'Your records show a different rent. Which is right?', 'Your records and your answer disagree.', (s) => rents(s) && s.known.rentConflict === true, { opts: ['stated', 'records'], stake: 0.4 }),
  follow('rentIncludesUtilities', 'housing', 'toggle', 'Does it include electricity and water?', 'If not, we add them as a bill.', (s) => (rents(s) && num(s, 'rent') > 0) || is(s, 'housing', 'company'), { stake: 0.2, variant: (s) => (is(s, 'housing', 'company') ? 'company' : undefined) }),
  follow('mortgagePayment', 'housing', 'amount', 'What is your monthly mortgage payment?', 'Counted as housing, not as a loan.', (s) => is(s, 'ownType', 'mortgage'), { stake: 0.7 }),
  follow('mortgageYears', 'housing', 'stepper', 'About how many years are left?', 'Tells us how long it runs.', (s) => is(s, 'ownType', 'mortgage'), { min: 1, max: 40, stake: 0.1, skippable: true }),
  follow('propertyCosts', 'housing', 'amount', 'Any monthly building fees, maintenance or property tax?', 'Owning has running costs.', (s) => is(s, 'housing', 'own'), { stake: 0.3, skippable: true }),
  follow('familyContribution', 'housing', 'toggle', 'Do you contribute to the household costs?', 'It is a regular commitment.', (s) => is(s, 'housing', 'family'), { stake: 0.4 }),
  follow('familyContributionAmount', 'housing', 'amount', 'How much each month?', 'Counted as housing.', (s) => is(s, 'familyContribution', true), { stake: 0.5 }),

  // ---- household
  n('household', 'household', 'chips', 'Who shares your household?', 'Sizes groceries, utilities and safety.', { tier: 'core', stake: 0.5, opts: ['solo', 'couple', 'family'] }),
  follow('dependents', 'household', 'stepper', 'How many children or dependants?', 'Each one raises essentials and the safety target.', (s) => is(s, 'household', 'family'), { min: 1, max: 10, stake: 0.35 }),
  follow('youngestChild', 'household', 'chips', 'How old is the youngest?', 'Decides between childcare and school costs.', (s) => num(s, 'dependents') > 0, { opts: ['under5', 'school', 'teen', 'adult'], stake: 0.3 }),
  follow('schoolFees', 'household', 'amount', 'What do school costs come to each month?', 'Often the second biggest fixed cost.', (s) => is(s, 'youngestChild', 'school') || is(s, 'youngestChild', 'teen'), { stake: 0.45, skippable: true }),
  follow('childcare', 'household', 'amount', 'What does childcare cost each month?', 'A fixed cost until school age.', (s) => is(s, 'youngestChild', 'under5'), { stake: 0.45, skippable: true }),
  n('partnerRole', 'household', 'chips', 'How does your partner fit in?', 'Shared costs are planned on your share only.', { stake: 0.4, opts: ['shares', 'separate', 'no_income', 'no_partner'], when: partnered }),
  follow('partnerSharePct', 'household', 'slider', 'What share of the shared costs do you cover?', 'Your plan covers your share, not the whole bill.', (s) => is(s, 'partnerRole', 'shares'), { min: 10, max: 100, stake: 0.35 }),
  n('supportsOthers', 'household', 'toggle', 'Do you regularly send money to family?', 'Remittances are a fixed commitment.', { stake: 0.42 }),
  follow('supportAmount', 'household', 'amount', 'How much each month?', 'Counted as a fixed commitment.', (s) => is(s, 'supportsOthers', true), { stake: 0.45 }),
  follow('householdHelpAmount', 'household', 'amount', 'Do you pay for household help? How much a month?', 'Common in larger households.', (s) => is(s, 'household', 'family') && is(s, 'youngestChild', 'under5'), { stake: 0.2, skippable: true }),

  // ---- life
  n('confirmBills', 'found', 'confirm', 'We found {n} regular bills and subscriptions. Are they right?', 'They are linked into your plan.', { tier: 'core', stake: 0.5, when: (s) => num(s, 'knownBillCount') > 0 }),
  n('transportMode', 'life', 'chips', 'How do you mostly get around?', 'Transport is the next biggest everyday line.', { stake: 0.3, opts: ['public', 'car', 'taxi', 'walk'] }),
  follow('carOwnership', 'life', 'chips', 'Is the car paid off?', 'A car payment is a fixed commitment.', (s) => car(s) && !has(s, 'debtKinds', 'loan'), { opts: ['owned', 'financed', 'leased'], stake: 0.4 }),
  follow('carOverlap', 'life', 'chips', 'Is the car payment one of the loans you listed?', 'So it is not counted twice.', (s) => car(s) && has(s, 'debtKinds', 'loan'), { opts: ['listed', 'separate', 'paid_off'], stake: 0.4 }),
  follow('carPayment', 'life', 'amount', 'What is the monthly payment?', 'Counted with your debts.', (s) => is(s, 'carOwnership', 'financed') || is(s, 'carOwnership', 'leased') || is(s, 'carOverlap', 'separate'), { stake: 0.6 }),
  follow('fuelAndUpkeep', 'life', 'amount', 'Fuel, parking and upkeep: about how much a month?', 'Running a car costs more than the car payment.', car, { stake: 0.3, skippable: true }),
  n('foodFrequency', 'life', 'chips', 'How often do you eat out or order in?', 'Sets your dining and groceries split.', { stake: 0.25, opts: ['everyday', 'mostdays', 'sometimes', 'rarely'] }),
  n('lifestyle', 'life', 'chips', 'How would you describe your spending style?', 'Moves every everyday cap up or down.', { stake: 0.35, opts: ['minimal', 'balanced', 'comfortable'] }),
  n('healthCover', 'life', 'chips', 'Is your health covered by insurance?', 'Uncovered health costs need a line.', { stake: 0.3, opts: ['full', 'partial', 'none'] }),
  follow('healthCost', 'life', 'amount', 'What do you spend on health a month?', 'Costs insurance does not cover.', (s) => is(s, 'healthCover', 'partial') || is(s, 'healthCover', 'none'), { stake: 0.3, skippable: true }),
  follow('chronicMeds', 'life', 'toggle', 'Do you take regular medication?', 'A steady cost to plan for.', (s) => is(s, 'healthCover', 'partial') || is(s, 'healthCover', 'none'), { stake: 0.2 }),
  follow('chronicAmount', 'life', 'amount', 'About how much a month?', 'Counted as health.', (s) => is(s, 'chronicMeds', true), { stake: 0.3 }),
  n('otherFixedBills', 'life', 'amount', 'Phone, internet, electricity and subscriptions: what do they cost together?', 'Your regular bills, so nothing is missed.', { stake: 0.3, skippable: true, when: (s) => num(s, 'knownBillCount') === 0 }),
  n('cashHeavy', 'life', 'toggle', 'Do you pay mostly in cash?', 'Cash spending is under-counted in your records.', { stake: 0.2, when: (s) => s.known.hasHistory === true }),

  // ---- debts
  n('confirmDebts', 'found', 'confirm', 'We found {n} debts and instalments. Are they right?', 'Their minimums are already in your plan.', { tier: 'core', stake: 0.6, when: (s) => num(s, 'knownDebtCount') > 0 }),
  n('moreDebts', 'debts', 'toggle', 'Anything else you owe, like a card, family or buy-now-pay-later?', 'Only what is not already tracked.', { stake: 0.45, when: (s) => num(s, 'knownDebtCount') > 0 }),
  n('hasDebts', 'debts', 'toggle', 'Do you owe money anywhere?', 'Costly debt comes before saving.', { tier: 'core', stake: 0.6, when: (s) => num(s, 'knownDebtCount') === 0 && s.intent !== 'debt', variant: (s) => (is(s, 'ownType', 'mortgage') ? 'mortgage' : is(s, 'carOwnership', 'financed') ? 'car' : undefined) }),
  follow('debtKinds', 'debts', 'multi', 'What kinds of debt?', 'Each kind is paid off differently.', isDebtor, { opts: ['card', 'loan', 'bnpl', 'family', 'student', 'tax'], stake: 0.5, variant: (s) => (num(s, 'knownDebtCount') > 0 ? 'known' : undefined) }),
  follow('cardPayFull', 'debts', 'toggle', 'Do you pay your card off in full every month?', 'If you do, it is spending, not debt.', (s) => kind(s, 'card'), { stake: 0.4 }),
  follow('cardBalance', 'debts', 'amount', 'How much is on the card now?', 'Sets the payoff order.', (s) => kind(s, 'card') && is(s, 'cardPayFull', false), { stake: 0.5 }),
  follow('cardMin', 'debts', 'amount', 'What do you pay on it each month?', 'The minimum comes first.', (s) => kind(s, 'card') && is(s, 'cardPayFull', false), { stake: 0.5 }),
  follow('cardApr', 'debts', 'chips', 'Roughly what interest does it charge?', 'The costliest debt is paid first.', (s) => kind(s, 'card') && is(s, 'cardPayFull', false), { opts: ['under15', '15_25', 'over25', 'unknown'], stake: 0.4, skippable: true }),
  follow('loanBalance', 'debts', 'amount', 'How much is left on your loan?', 'Sets the payoff order.', (s) => kind(s, 'loan'), { stake: 0.5 }),
  follow('loanMin', 'debts', 'amount', 'What is the monthly payment?', 'Counted as a fixed cost.', (s) => kind(s, 'loan'), { stake: 0.5 }),
  follow('loanApr', 'debts', 'chips', 'Roughly what interest does it charge?', 'The costliest debt is paid first.', (s) => kind(s, 'loan'), { opts: ['under15', '15_25', 'over25', 'unknown'], stake: 0.35, skippable: true }),
  follow('bnplMonthly', 'debts', 'amount', 'What do your instalments come to each month?', 'Counted as a fixed cost until they end.', (s) => kind(s, 'bnpl'), { stake: 0.45 }),
  follow('bnplLeft', 'debts', 'stepper', 'How many months until the last one?', 'The plan frees that money when they end.', (s) => kind(s, 'bnpl'), { min: 1, max: 36, stake: 0.2, skippable: true }),
  follow('familyOwed', 'debts', 'amount', 'How much do you owe family or friends?', 'Informal debt still counts.', (s) => kind(s, 'family'), { stake: 0.4 }),
  follow('familyMonthly', 'debts', 'amount', 'How much have you agreed to repay each month?', 'Zero is fine if there is no schedule.', (s) => kind(s, 'family'), { stake: 0.3 }),
  follow('studentBalance', 'debts', 'amount', 'How much is left on your student loan?', 'Usually the lowest-priority debt.', (s) => kind(s, 'student'), { stake: 0.3 }),
  follow('studentMin', 'debts', 'amount', 'What is the monthly payment?', 'Zero if it is deferred.', (s) => kind(s, 'student'), { stake: 0.3 }),
  follow('taxOwed', 'debts', 'amount', 'How much do you owe in back taxes or fines?', 'Often carries penalties, so it goes first.', (s) => kind(s, 'tax'), { stake: 0.5 }),
  follow('taxPlan', 'debts', 'chips', 'Is there a payment plan?', 'A plan sets the monthly amount.', (s) => kind(s, 'tax'), { opts: ['plan', 'lump_sum', 'none'], stake: 0.3 }),
  follow('behind', 'debts', 'toggle', 'Are you behind on any payment right now?', 'Late payments change the order of everything.', (s) => isDebtor(s) && debtCount(s) > 0, { stake: 0.4 }),
  follow('arrears', 'debts', 'amount', 'How much is overdue?', 'We clear it before anything else.', (s) => is(s, 'behind', true), { stake: 0.5 }),
  follow('debtStrategy', 'debts', 'chips', 'How do you want to pay them off?', 'Smallest first feels fast. Highest interest saves the most.', (s) => debtCount(s) >= 2, { opts: ['avalanche', 'snowball', 'balanced'], stake: 0.4 }),
  follow('debtExtra', 'debts', 'amount', 'Beyond the minimums, how much extra could go to debt?', 'Sets your debt-free date.', (s) => s.intent === 'debt' && debtCount(s) >= 1, { stake: 0.5, skippable: true }),

  // ---- security
  n('saveTarget', 'security', 'chips', 'How much would you like to save each month?', 'We build the rest of the plan around it.', { tier: 'core', stake: 0.7, opts: ['p10', 'p20', 'p30', 'custom', 'unsure'], when: (s) => s.intent === 'save' }),
  follow('saveCustom', 'security', 'amount', 'How much?', 'Your own target.', (s) => is(s, 'saveTarget', 'custom'), { stake: 0.6 }),
  n('saveObstacle', 'security', 'multi', 'What makes saving hard right now?', 'We tighten those areas first.', { tier: 'core', stake: 0.5, opts: ['dining', 'shopping', 'bills', 'irregular', 'debt', 'unplanned'], when: (s) => s.intent === 'save' }),
  n('savingsOnHand', 'security', 'amount', 'How much do you have saved right now?', 'Decides how urgent the safety net is.', { tier: 'core', stake: 0.5 }),
  n('emergencyMonths', 'security', 'stepper', 'How many months of costs should your safety net cover?', 'Three is standard. Six if your income or family needs more.', { stake: 0.25, min: 1, max: 12 }),
  n('lifeInsurance', 'security', 'toggle', 'Do you have life or income-protection cover?', 'Dependants rely on your income.', { stake: 0.45, when: (s) => num(s, 'dependents') > 0 || is(s, 'partnerRole', 'no_income') }),
  follow('insurancePremium', 'security', 'amount', 'What is the monthly premium?', 'A fixed cost.', (s) => is(s, 'lifeInsurance', true), { stake: 0.25 }),
  n('retirement', 'security', 'chips', 'How are you saving for retirement?', 'A pension or social insurance counts.', { stake: 0.25, opts: ['employer', 'self', 'none'] }),
  follow('retirementAmount', 'security', 'amount', 'How much do you put in each month?', 'Counted as saving.', (s) => is(s, 'retirement', 'self'), { stake: 0.3 }),
  n('investing', 'security', 'chips', 'Do you invest, or want to?', 'Kept in the plan so it does not stop. Offered only when debt and safety are in hand.', { stake: 0.2, opts: ['already', 'want_to', 'not_now'], when: (s) => !highAprDebt(s) && monthsHeld(s) >= 1 }),
  follow('investMonthly', 'security', 'amount', 'How much each month?', 'Counted as saving.', (s) => is(s, 'investing', 'already'), { stake: 0.3 }),
  n('zakatMode', 'security', 'chips', 'Do you set money aside for zakat or giving?', 'We reserve it before you spend.', { stake: 0.2, opts: ['yes_auto', 'yes_amount', 'no'] }),
  follow('zakatAmount', 'security', 'amount', 'How much each month?', 'Reserved first.', (s) => is(s, 'zakatMode', 'yes_amount'), { stake: 0.35 }),

  // ---- goals
  n('confirmGoals', 'found', 'confirm', 'We found {n} goals. Keep them in the plan?', 'Their monthly draw is already counted.', { tier: 'core', stake: 0.4, when: (s) => num(s, 'knownGoalCount') > 0 }),
  n('hasGoal', 'goals', 'toggle', 'Is there something big you are saving for?', 'Goals get their own line.', { stake: 0.3, when: (s) => num(s, 'knownGoalCount') === 0 && s.intent !== 'goal' }),
  follow('goalKind', 'goals', 'chips', 'What is it?', 'Shapes the questions that follow.', wantsGoal, { opts: ['vacation', 'house', 'car', 'education', 'wedding', 'pilgrimage', 'business', 'other'], stake: 0.2 }),
  follow('houseScope', 'goals', 'chips', 'Is that the full price or the down payment?', 'We plan only what you must save.', (s) => is(s, 'goalKind', 'house'), { opts: ['full_price', 'down_payment'], stake: 0.3 }),
  follow('educationFor', 'goals', 'chips', 'Is the education for you or a child?', 'A child usually means a later start date.', (s) => is(s, 'goalKind', 'education'), { opts: ['me', 'child'], stake: 0.2 }),
  follow('goalTarget', 'goals', 'amount', 'How much does it cost?', 'The total you need.', wantsGoal, { stake: 0.5, variant: (s) => (is(s, 'houseScope', 'down_payment') ? 'down' : undefined) }),
  follow('goalSaved', 'goals', 'amount', 'How much have you already set aside for it?', 'Counts toward the total.', (s) => wantsGoal(s) && num(s, 'goalTarget') > 0, { stake: 0.25, skippable: true }),
  follow('goalTiming', 'goals', 'chips', 'Do you need it by a date, or set how much to save?', 'Either way we work out the other.', (s) => wantsGoal(s) && num(s, 'goalTarget') > 0, { opts: ['by_date', 'by_amount'], stake: 0.3 }),
  follow('goalMonths', 'goals', 'stepper', 'In how many months?', 'Sets the monthly amount.', (s) => is(s, 'goalTiming', 'by_date'), { min: 1, max: 120, stake: 0.4 }),
  follow('goalMonthly', 'goals', 'amount', 'How much can you save for it each month?', 'We work out when you get there.', (s) => is(s, 'goalTiming', 'by_amount'), { stake: 0.4 }),
  n('anotherGoal', 'goals', 'toggle', 'There is room left. Add another goal?', 'Offered only when the first goal fits comfortably.', { tier: 'follow', stake: 0.2, needs: ['income', 'housing', 'household', 'life', 'debts', 'goals'], when: (s) => hasAnyGoal(s) && s.a.goalTarget !== undefined && goalMonthlyNeed(s) < Math.max(0, slack(s)) * 0.3 }),
  follow('goal2Target', 'goals', 'amount', 'How much does the second one cost?', 'Planned after the first.', (s) => is(s, 'anotherGoal', true), { stake: 0.25, needs: ['goals'] }),
  follow('goal2Months', 'goals', 'stepper', 'In how many months?', 'Sets its monthly amount.', (s) => is(s, 'anotherGoal', true), { min: 1, max: 120, stake: 0.25, needs: ['goals'] }),

  // ---- annual
  n('annualKinds', 'annual', 'multi', 'Any big costs that come once or twice a year?', 'We spread them across the months so they never hit at once.', { stake: 0.3, opts: ['car_yearly', 'school_start', 'travel', 'festive', 'home_repairs', 'medical', 'renewals'] }),
  n('bigSoon', 'annual', 'multi', 'Anything big coming in the next two years?', 'A baby, a wedding or a move changes what the plan should protect.', { stake: 0.35, opts: ['baby', 'wedding', 'move', 'car', 'medical'] }),
  follow('bigSoonAmount', 'annual', 'amount', 'About how much will it cost in total?', 'Set aside a month at a time until it arrives.', (s) => ((get(s, 'bigSoon') as string[] | undefined)?.length ?? 0) > 0, { stake: 0.45, skippable: true }),
  follow('bigSoonMonths', 'annual', 'stepper', 'In how many months?', 'Sets the monthly amount.', (s) => ((get(s, 'bigSoon') as string[] | undefined)?.length ?? 0) > 0, { min: 1, max: 24, stake: 0.4 }),
  follow('annualTotal', 'annual', 'amount', 'About how much in a year, altogether?', 'Divided by twelve and set aside.', (s) => ((get(s, 'annualKinds') as string[] | undefined)?.length ?? 0) > 0, { stake: 0.35, skippable: true }),

  // ---- priorities
  n('priorities', 'priorities', 'multi', 'What matters most right now?', 'Choose up to three. Ties are broken in this order.', { tier: 'core', stake: 0.3, max: 3, opts: ['safety', 'debt', 'goals', 'invest', 'enjoy', 'family'] }),
  n('securityLean', 'priorities', 'slider', 'Save hard, or live comfortably?', 'Moves the whole plan along this line. Asked only when there is room to choose.', { tier: 'follow', stake: 0.25, min: 0, max: 100, when: (s) => slack(s) > planIncome(s) * 0.12 }),

  // ---- checks that need the whole picture
  n('housingChange', 'priorities', 'chips', 'Housing takes a big share. Is that likely to change?', 'Tells us whether to plan for relief or a rise.', { tier: 'follow', stake: 0.3, opts: ['stable', 'lease_end', 'can_reduce', 'will_rise'], needs: ['income', 'housing'], when: (s) => housingMonthly(s) / (planIncome(s) || 1) > 0.4 }),
  n('deficitPlan', 'priorities', 'multi', 'Your fixed costs leave almost nothing. What could change?', 'We build a stabilising plan around what you can move.', { tier: 'follow', stake: 0.9, opts: ['lower_rent', 'refinance', 'extra_income', 'pause_goals', 'family_help', 'none'], needs: ['income', 'housing', 'household', 'life', 'debts'], when: (s) => planIncome(s) > 0 && slack(s) < planIncome(s) * 0.03 }),
  follow('extraIncome', 'priorities', 'amount', 'How much extra income could you add?', 'Shown as a possible plan, not counted yet.', (s) => has(s, 'deficitPlan', 'extra_income'), { stake: 0.5, needs: ['income'] }),
  n('goalAdjust', 'goals', 'chips', 'That goal needs more than your plan can spare. What would you like to do?', 'We would rather adjust it now than fail later.', { tier: 'follow', stake: 0.8, opts: ['extend', 'lower', 'save_more', 'keep'], needs: ['income', 'housing', 'household', 'life', 'debts', 'goals'], when: (s) => hasAnyGoal(s) && goalMonthlyNeed(s) > Math.max(0, slack(s)) * 0.6 && goalMonthlyNeed(s) > 0 }),
  follow('goalMonthsNew', 'goals', 'stepper', 'Move it to how many months?', 'A later date lowers the monthly amount.', (s) => is(s, 'goalAdjust', 'extend'), { min: 1, max: 240, stake: 0.5, needs: ['goals'] }),
  follow('goalTargetNew', 'goals', 'amount', 'What target works?', 'A lower target fits the plan.', (s) => is(s, 'goalAdjust', 'lower'), { stake: 0.5, needs: ['goals'] }),
  n('goalVsSafety', 'goals', 'chips', 'You have little saved. Goal first, or safety first?', 'Both cannot come first.', { tier: 'follow', stake: 0.6, opts: ['goal_first', 'balanced', 'safety_first'], needs: ['income', 'debts', 'security', 'goals'], when: (s) => hasAnyGoal(s) && (monthsHeld(s) < 1 || highAprDebt(s)) }),
  n('cutFirst', 'priorities', 'multi', 'If money gets tight, what should we trim first?', 'Your plan then cuts those lines before the rest.', { tier: 'follow', stake: 0.5, opts: ['dining', 'fun', 'shopping', 'subscriptions', 'transport', 'groceries'], needs: ['income', 'housing', 'household', 'life', 'debts', 'security'], when: (s) => planIncome(s) > 0 && slack(s) < planIncome(s) * 0.12 && essentialsEstimate(s) > 0 }),
]

const GROUPS: Record<string, readonly string[]> = {
  found: ['confirmIncome', 'confirmBills', 'confirmDebts', 'confirmGoals'],
  incomeKind: ['incomeType', 'incomeStability', 'jobSecurity'],
  slowMonth: ['lowMonth'],
  tax: ['taxSetAside', 'taxPct'],
  paySchedule: ['payFrequency', 'payday'],
  home: ['housing', 'ownType'],
  rentCard: ['rent', 'rentFreq', 'rentIncludesUtilities'],
  mortgageCard: ['mortgagePayment', 'mortgageYears', 'propertyCosts'],
  familyHome: ['familyContribution', 'familyContributionAmount'],
  kids: ['dependents', 'youngestChild'],
  partner: ['partnerRole', 'partnerSharePct'],
  sendMoney: ['supportsOthers', 'supportAmount'],
  car: ['carOwnership', 'carOverlap', 'carPayment', 'fuelAndUpkeep'],
  health: ['healthCover', 'healthCost', 'chronicMeds', 'chronicAmount'],
  card: ['cardPayFull', 'cardBalance', 'cardMin', 'cardApr'],
  loan: ['loanBalance', 'loanMin', 'loanApr'],
  bnpl: ['bnplMonthly', 'bnplLeft'],
  famDebt: ['familyOwed', 'familyMonthly'],
  student: ['studentBalance', 'studentMin'],
  taxDebt: ['taxOwed', 'taxPlan'],
  late: ['behind', 'arrears'],
  saveGoal: ['saveTarget', 'saveCustom'],
  cover: ['lifeInsurance', 'insurancePremium'],
  pension: ['retirement', 'retirementAmount'],
  invest: ['investing', 'investMonthly'],
  zakat: ['zakatMode', 'zakatAmount'],
  goalWhat: ['goalKind', 'houseScope', 'educationFor'],
  goalCost: ['goalTarget', 'goalSaved'],
  goalWhen: ['goalTiming', 'goalMonths', 'goalMonthly'],
  goalChange: ['goalAdjust', 'goalMonthsNew', 'goalTargetNew'],
  goalTwo: ['anotherGoal', 'goal2Target', 'goal2Months'],
  yearly: ['annualKinds', 'annualTotal'],
  soon: ['bigSoon', 'bigSoonAmount', 'bigSoonMonths'],
  deficit: ['deficitPlan', 'extraIncome'],
}
const GROUP_OF = new Map(Object.entries(GROUPS).flatMap(([g, ids]) => ids.map((id) => [id, g] as const)))
for (const g of GROUP_OF.keys()) if (!ALL.some((x) => x.id === g)) throw new Error(`unknown node in GROUPS: ${g}`)

export const NODES: readonly FlowNode[] = ALL.map((x) => ({ ...x, group: GROUP_OF.get(x.id) ?? x.id }))
export const NODE_BY_ID = new Map(NODES.map((x) => [x.id, x]))
