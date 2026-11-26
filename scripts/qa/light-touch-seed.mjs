/**
 * Seeds the dev-auth-bypass app (NEXT_PUBLIC_DEV_AUTH_BYPASS=1) through the window store hooks
 * (`__finance`, `__qa`) exposed by DevAuthBypassSeed. Runs inside the page via page.evaluate.
 * Data lives in localStorage ('buddget-storage'), so it survives page.goto in the same context.
 */
export function seedInPage() {
  const f = window.__finance
  const st = () => f.getState()
  const pad = (n) => String(n).padStart(2, '0')
  const day = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const monthDay = (monthOffset, dom) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + monthOffset)
    d.setDate(Math.min(dom, 28))
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  st().updateGoldPrice(4400)

  // Accounts and cards
  const cib = st().addPaymentMethod({ name: 'CIB', label: 'CIB Current', type: 'bank_account', currency: 'EGP', last4: '1234', openingBalance: 120425, openingAt: monthDay(-2, 1), isDefault: true, color: '#0f4c81' })
  // Card faces as the mockup draws them: dark green debit, black metal credit, navy debit, coral prepaid.
  const cibDebit = st().addPaymentMethod({ name: 'CIB', label: 'CIB Debit', type: 'debit_card', currency: 'EGP', last4: '1234', parentId: cib, isDefault: false, cardStyle: 'bank', cardTheme: 'emerald' })
  const cibCredit = st().addPaymentMethod({ name: 'CIB Platinum', type: 'credit_card', currency: 'EGP', last4: '7781', parentId: cib, isDefault: false, cardStyle: 'metal', cardTheme: 'blackMetal' })
  st().addPaymentMethod({ name: 'CIB', label: 'CIB Prepaid', type: 'prepaid_card', currency: 'EGP', last4: '2290', parentId: cib, isDefault: false, cardStyle: 'bank', cardTheme: 'sunset' })
  const qnb = st().addPaymentMethod({ name: 'QNB', type: 'bank_account', currency: 'EGP', last4: '5512', openingBalance: 47500, openingAt: monthDay(-2, 1), isDefault: false })
  st().addPaymentMethod({ name: 'QNB', type: 'debit_card', currency: 'EGP', last4: '6620', parentId: qnb, isDefault: false, cardStyle: 'bank', cardTheme: 'navy' })
  const payroll = st().addPaymentMethod({ name: 'CIB Payroll', type: 'bank_account', currency: 'EGP', last4: '9001', openingBalance: 31500, openingAt: monthDay(-2, 1), isDefault: false })
  st().addPaymentMethod({ name: 'Vodafone Cash', type: 'wallet', currency: 'EGP', last4: '0082', openingBalance: 2400, openingAt: monthDay(-2, 1), isDefault: false })

  const cardDebt = st().debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === cibCredit)
  if (cardDebt) st().updateDebt(cardDebt.id, { creditLimit: 30000, startingBalance: 8420, paymentDueDay: 15 })

  // Budget plan
  const plan = st().addBudgetPlan('My budget', { status: 'ready' })
  const lines = [
    ['Rent', 'Home', 7000, 'bills', 1],
    ['Food', 'Utensils', 4000, 'everyday'],
    ['Groceries', 'ShoppingCart', 6000, 'everyday'],
    ['Transport', 'Car', 1800, 'everyday'],
    ['Utilities', 'Zap', 1800, 'bills', 10],
    ['Enjoyment', 'Sparkles', 1500, 'everyday'],
    ['Shopping', 'ShoppingBag', 2400, 'everyday'],
  ]
  for (const [name, icon, amount, block, dueDay] of lines) {
    st().addPlanCategory(plan, { name, icon, amount, currency: 'EGP', block, dueDay: dueDay ?? null, expenseCategories: [name] })
  }

  // Expenses across this month and last month
  const spend = [
    ['Talabat', 'Food', 245, cibCredit], ['Uber', 'Transport', 96, cibDebit], ['Carrefour', 'Groceries', 1240, cibDebit],
    ['Cilantro', 'Food', 65, cibDebit], ['Wataniya fuel', 'Transport', 450, qnb], ['IKEA', 'Shopping', 3400, cibCredit],
    ['Zooba', 'Food', 400, qnb], ['Rent · November', 'Rent', 7000, cib], ['Electricity', 'Utilities', 620, cib],
    ['Spinneys', 'Groceries', 312.5, cibDebit], ['Cinema', 'Enjoyment', 360, cibCredit],
  ]
  spend.forEach(([description, category, amount, pm], i) => {
    const date = day(-Math.min(i * 2, 24))
    st().addExpense({ description, category, amount, currency: 'EGP', paymentMethodId: pm, isRecurring: false, date, occurredAt: `${date}T${pad(9 + (i % 10))}:15:00` })
  })
  const receiptId = st().addReceipt({ merchant: 'Carrefour Maadi City Centre', amount: 1840, currency: 'EGP', receiptDate: day(-1), category: 'Groceries', paymentMethodId: cibDebit, items: [{ name: 'Fresh milk 1 L', price: 85, qty: 2 }, { name: 'Eggs, 30 pieces', price: 165 }, { name: 'Chicken breast 1 kg', price: 289 }, { name: 'Basmati rice 5 kg', price: 610 }, { name: 'Olive oil', price: 606 }], charges: [] })
  st().addExpense({ description: 'Carrefour', category: 'Groceries', amount: 1840, currency: 'EGP', paymentMethodId: cibDebit, isRecurring: false, date: day(-1), occurredAt: `${day(-1)}T18:05:00`, receiptId })
  spend.forEach(([description, category, amount, pm], i) => {
    const date = monthDay(-1, 2 + i * 2)
    st().addExpense({ description, category, amount: Math.round(amount * 1.1), currency: 'EGP', paymentMethodId: pm, isRecurring: false, date, occurredAt: `${date}T12:30:00` })
  })

  // Income: salary for the last two paydays
  const salary = st().incomeSources.find((s) => s.sourceType === 'salary')
  // Paydays hero names the account the salary lands in (mockup "Salary · Monthly → CIB Payroll").
  // Six months of history (mockup "On time 6 of 6", May..Oct check row); the source has been counting since then.
  if (salary) st().updateIncomeSource(salary.id, { paymentMethodId: payroll, effectiveStart: monthDay(-6, 1) })
  for (const m of [-5, -4, -3, -2, -1, 0]) {
    const date = monthDay(m, 5)
    st().addIncomeEvent({ templateId: salary?.id ?? null, name: 'Salary · Nexta', amount: 42000, currency: 'EGP', sourceType: 'salary', receivedDate: date, occurrenceDate: date, status: 'confirmed', paymentMethodId: payroll })
  }

  // Pockets, emergency fund, gold
  const cert = st().addSavingsAccount({ name: 'CIB savings certificate', type: 'bank', currency: 'EGP', openingBalance: 96940, institution: 'CIB', yearlyReturn: 17.5 })
  const ef = st().addSavingsAccount({ name: 'Emergency fund', type: 'cash', currency: 'EGP', openingBalance: 18600, isEmergencyCover: true })
  const dahab = st().addSavingsAccount({ name: 'Trip to Dahab', type: 'vault', category: 'savings', currency: 'EGP', openingBalance: 15000, heldInPaymentMethodId: cib })
  const umrah = st().addSavingsAccount({ name: 'Umrah 2027', type: 'vault', category: 'savings', currency: 'EGP', openingBalance: 18000 })
  const giftPocket = st().addSavingsAccount({ name: 'Wedding gift', type: 'vault', category: 'savings', currency: 'EGP', openingBalance: 15000 })
  st().updateSettings({ emergencyFundConfig: { targetMonths: 3 }, zakatConfig: { nisabBasis: 'gold', nisabBasisChosen: true, holdsForTrading: false } })
  st().addInvestmentHolding({ assetType: 'gold', name: 'Gold 21k', quantity: 18, currency: 'EGP', karat: 21, goldUnit: 'grams', unitCost: 3200, purchaseDate: monthDay(-1, 12) })

  // Goals: active and achieved
  const target = (months) => monthDay(months, 1)
  st().addGoal({ name: 'Trip to Dahab', emoji: '✈️', category: 'vacation', targetAmount: 50000, currency: 'EGP', targetDate: target(16), linkedSavingsAccountIds: [dahab], linkedDebtIds: [], monthlySpendingLimit: null, priority: 1, status: 'active', monthlyContribution: null, fundingMode: 'share', sharePct: 20, notes: null })
  st().addGoal({ name: 'Umrah 2027', emoji: 'moon-star', category: 'custom', targetAmount: 30000, currency: 'EGP', targetDate: target(16), linkedSavingsAccountIds: [umrah], linkedDebtIds: [], monthlySpendingLimit: null, priority: 2, status: 'active', monthlyContribution: 2000, fundingMode: 'fixed', notes: null })
  st().addGoal({ name: 'New car', emoji: '🚗', category: 'car', targetAmount: 400000, currency: 'EGP', targetDate: target(36), linkedSavingsAccountIds: [], linkedDebtIds: [], monthlySpendingLimit: null, priority: 3, status: 'active', monthlyContribution: 6000, fundingMode: 'fixed', manualCurrentAmount: 64000, notes: null })
  const gift = st().addGoal({ name: 'Wedding gift', emoji: '🎁', category: 'gift', targetAmount: 15000, currency: 'EGP', targetDate: target(-1), linkedSavingsAccountIds: [giftPocket], linkedDebtIds: [], monthlySpendingLimit: null, priority: 4, status: 'active', monthlyContribution: null, fundingMode: 'manual', notes: null })
  st().achieveGoal(gift)

  // Debts: borrowed, installment, car loan (card debt came with the credit card)
  st().addDebt({ name: 'Ahmed', person: 'Ahmed', personName: 'Ahmed', direction: 'i_owe', debtType: 'personal', startingBalance: 4200, currency: 'EGP', isGold: false, status: 'active', startDate: monthDay(-1, 3) })
  st().addDebt({ name: 'Ahmed', person: 'Ahmed', personName: 'Ahmed', direction: 'they_owe', debtType: 'personal', description: 'Zooba', startingBalance: 400, currency: 'EGP', isGold: false, status: 'active', startDate: day(-3) })
  const valu = st().addDebt({ name: 'iPhone 16', person: 'valU', debtType: 'installment', installmentProvider: 'other', installmentProviderName: 'valU', installmentCount: 12, installmentFrequency: 'monthly', installmentAmount: 1400, startingBalance: 16800, currency: 'EGP', isGold: false, status: 'active', startDate: monthDay(-6, 3), defaultPaymentMethodId: cibCredit })
  const car = st().addDebt({ name: 'Car loan', person: 'CIB', creditor: 'CIB', debtType: 'installment', installmentProvider: 'other', installmentCount: 38, installmentFrequency: 'monthly', installmentAmount: 3250, startingBalance: 78000, currency: 'EGP', isGold: false, status: 'active', startDate: monthDay(-11, 5) })
  for (const m of [-1, 0]) {
    st().addDebtPayment({ debtId: car, date: monthDay(m, 5), amountPaid: 3250, paymentMethodId: cibDebit })
    st().addDebtPayment({ debtId: valu, date: monthDay(m, 3), amountPaid: 1400, paymentMethodId: cibCredit })
  }
  const old = st().addDebt({ name: 'Car repair', person: 'Mona', personName: 'Mona', direction: 'i_owe', debtType: 'personal', startingBalance: 18000, currency: 'EGP', isGold: false, status: 'active', startDate: monthDay(-10, 1) })
  st().addDebtPayment({ debtId: old, date: monthDay(-4, 1), amountPaid: 18000, paymentMethodId: cib })
  st().clearDebt(old, monthDay(-4, 1))

  // Subscriptions
  const sub = (name, brandKey, amount, currency, billingDay, pm, expenseCategory = 'Subscription', planName = null) =>
    st().addSubscription({ name, brandKey, planName, planId: null, catalogRegion: null, pendingPlanId: null, pendingAmount: null, amount, currency, billingCycle: 'monthly', billingDay, startDate: monthDay(-6, billingDay), nextBillingDate: null, paymentMethodId: pm, expenseCategory, status: 'active', notes: null, tracking: 'sms', reminder: true })
  sub('Netflix', 'netflix', 9.99, 'USD', 2, cibCredit, 'Enjoyment', 'Premium')
  const spotify = sub('Spotify', 'spotify', 99, 'EGP', 4, cibDebit)
  const icloud = sub('iCloud+', 'icloud', 49, 'EGP', 9, cibDebit)
  // This month's charges for two of them, so Subscriptions shows "Paid this month" and the hero bar (mockup page-subs).
  for (const [subId, description, amount, dom] of [[spotify, 'Spotify', 99, 4], [icloud, 'iCloud+', 49, 9]]) {
    const date = monthDay(0, dom)
    st().addExpense({ description, category: 'Subscription', amount, currency: 'EGP', paymentMethodId: cibDebit, isRecurring: false, date, occurredAt: `${date}T08:00:00`, linkedSubscriptionId: subId })
  }
  sub('Shahid VIP', 'shahid', 120, 'EGP', 14, cibDebit)

  return { accounts: st().paymentMethods.length, expenses: st().expenses.length, goals: st().goals.length, debts: st().debts.length, subs: st().subscriptions.length, pockets: st().savingsAccounts.length, cert, ef }
}
