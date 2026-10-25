import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { defineTools } from '@/lib/buddgy/tools/define'
import { savingsLabels } from '@/lib/buddgy/tools/exec/savingsCopy'
import { restoreRows, revertRows } from '@/lib/buddgy/tools/exec/restoreKit'
import { goalsOnPocket, inPocketCurrency, ledgerUndo, no, pick, posted, priceLookup, snapshotLedger, type Refusal } from '@/lib/buddgy/tools/exec/wealthKit'
import type { EditableField, PreviewRow } from '@/lib/buddgy/tools/proposal'
import { refOf } from '@/lib/buddgy/tools/refs'
import { savingsSpecs } from '@/lib/buddgy/tools/specs/savings'
import { fin, ui } from '@/lib/buddgy/tools/stores'
import type { ReadImpl, ToolContext, WriteImpl } from '@/lib/buddgy/tools/types'
import { makeProposal, money, num, ok, parseIsoDate, text } from '@/lib/buddgy/tools/writeKit'
import { buildWealth } from '@/lib/savings/wealthModel'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { goldToGrams, valueInvestmentHolding, type GoldUnit } from '@/lib/savings/holdingValuation'
import { POCKET_KINDS, type PocketKind } from '@/lib/savings/pocketKinds'
import type { Currency, FinanceStore, GoldKarat, InvestmentAssetType, InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { canDeletePocket } from '@/lib/savings/canDeletePocket'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'

const r0 = (n: number) => Math.round(n)
const r2 = (n: number) => Math.round(n * 100) / 100
const POCKET_HINT = 'Find it with list_savings first.'
const ASSET_HINT = 'Find it with list_savings first.'
const KARATS: GoldKarat[] = [24, 22, 21, 18]

const pocketOf = (s: FinanceStore, input: unknown) => pick(s.savingsAccounts, input, (a) => a.name, 'pocket', POCKET_HINT)
const assetOf = (s: FinanceStore, input: unknown) => pick(s.investmentHoldings, input, (h) => h.name, 'asset', ASSET_HINT)

const goalNames = (s: FinanceStore, ...pocketIds: string[]) =>
  [...new Set(pocketIds.flatMap((id) => goalsOnPocket(s, id).map((g) => g.name)))].join(', ')

const RECENT_MS = 2 * 60_000

/** The app values every holding in EGP whatever the base currency, so a typed worth is stored as EGP. */
function typedWorthInEgp(s: FinanceStore, value: number): { egp: number } | { error: Refusal } {
  const base = s.settings.baseCurrency
  const egp = tryConvertCurrency(value, base, 'EGP', s.exchangeRates)
  if (egp === null) return { error: no(`No exchange rate from ${base} to EGP, and holdings are valued in EGP.`, 'Ask the user for the worth in EGP.') }
  return { egp: r2(egp) }
}

const holdingValueBase = (s: FinanceStore, h: InvestmentHolding): number | null => {
  const v = valueInvestmentHolding(h, priceLookup())
  return v.priced && v.value !== null ? tryConvertCurrency(v.value, 'EGP', s.settings.baseCurrency, s.exchangeRates) : null
}

const list_savings: ReadImpl = () => {
  const s = fin()
  const base = s.settings.baseCurrency
  const model = buildWealth({
    accounts: s.savingsAccounts,
    holdings: s.investmentHoldings,
    lookup: priceLookup(),
    baseCurrency: base,
    rates: s.exchangeRates,
    goldPricePerGram: s.goldPricePerGram,
    goldOk: s.goldPriceAvailable !== false,
  })
  const byValue = (a: { amount: number | null }, b: { amount: number | null }) => (b.amount ?? -1) - (a.amount ?? -1)
  const pockets = model.rows.filter((r) => r.source === 'account').sort(byValue)
  const assets = model.rows.filter((r) => r.source === 'holding').sort(byValue)
  return {
    currency: base,
    total: r0(model.total),
    ...(model.anyUnpriced ? { incomplete: true } : {}),
    pockets: pockets.slice(0, 15).map((r) => {
      const a = r.account as SavingsAccount
      return {
        ref: refOf(a.id),
        name: a.name,
        type: a.type,
        bal: r2(a.currentBalance),
        ccy: a.currency,
        ...(a.currency !== base ? { value: r.amount === null ? null : r0(r.amount) } : {}),
        ...(a.isEmergencyCover ? { emergency: true } : {}),
      }
    }),
    ...(pockets.length > 15 ? { more_pockets: pockets.length - 15 } : {}),
    assets: assets.slice(0, 15).map((r) => {
      const h = r.holding as InvestmentHolding
      return {
        ref: refOf(h.id),
        kind: h.assetType,
        name: h.name,
        ...(h.assetType === 'property' ? {} : { qty: h.quantity }),
        ...(h.karat ? { karat: h.karat } : {}),
        value: r.amount === null ? null : r0(r.amount),
      }
    }),
    ...(assets.length > 15 ? { more_assets: assets.length - 15 } : {}),
  }
}

const get_net_worth: ReadImpl = () => {
  const raw = fin()
  // A not-counted credit card takes its debt out of net worth, as it does in the app.
  const s = { ...raw, debts: countedDebts(raw.debts, raw.paymentMethods), debtPayments: countedDebtPayments(raw.debtPayments, raw.debts, raw.paymentMethods) }
  const stats = computeMonthlyStats({ ...s, monthFilter: ui().monthFilter, trustLocalFinance: true })
  const basis = accountsBasisFor({
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: raw.debtPayments,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments,
    convert: (a, from, to) => tryConvertCurrency(a, from, to, s.exchangeRates),
  }, s.settings.baseCurrency)
  const nw = computeNetWorth({
    ...basis,
    savingsAccounts: s.savingsAccounts,
    investmentHoldings: s.investmentHoldings,
    debts: s.debts,
    settings: s.settings,
    exchangeRates: s.exchangeRates,
    goldPricePerGram: s.goldPricePerGram,
    goldPriceAvailable: s.goldPriceAvailable,
    lookup: priceLookup(),
    monthlyIncome: stats.totalIncome,
    cashOutflow: stats.cashOutflow,
    debtRemaining: stats.debtRemainingTotal,
  })
  return {
    currency: nw.baseCurrency,
    net_worth: r0(nw.netWorth),
    savings: r0(nw.totalSavings),
    investments: r0(nw.totalInvestments),
    debt: r0(nw.totalDebt),
    month_flow: r0(nw.monthlyFlow),
    ...(nw.netWorthIncomplete ? { incomplete: true } : {}),
  }
}

function enabledCurrency(s: FinanceStore, input: unknown): { currency: Currency } | { error: Refusal } {
  const currency = (text(input, 8)?.toUpperCase() ?? s.settings.baseCurrency) as Currency
  if (clampFiatToAllowed(s.settings, currency) !== currency) {
    return { error: no(`${currency} is not an enabled currency in this app.`, 'Ask for the amount in the base currency.') }
  }
  return { currency }
}

const add_savings_account: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const name = text(args.name, 40)
    if (!name) return no('A pocket needs a name.')
    if (!['bank', 'wallet', 'cash', 'other'].includes(args.kind as string)) return no('kind must be bank, wallet, cash or other.')
    const kind = args.kind as PocketKind
    const ccy = enabledCurrency(s, args.currency)
    if ('error' in ccy) return ccy.error
    const balance = args.balance === undefined ? 0 : num(args.balance)
    if (balance === undefined || balance < 0) return no('The balance cannot be negative.')
    const duplicate = s.savingsAccounts.some((a) => a.name.trim().toLowerCase() === name.toLowerCase())
    return ok(
      makeProposal({
        tool: 'add_savings_account',
        args: { name, kind, currency: ccy.currency, ...(balance > 0 ? { balance } : {}) },
        risk: 'approve',
        summary: `Pending approval: add pocket ${name}.`,
        preview: {
          domain: 'savings',
          tone: 'add',
          title: L.addPocket,
          rows: [
            { label: L.name, value: name },
            { label: L.type, value: L.kinds[kind as keyof typeof L.kinds] },
            { label: L.openingBalance, value: money(balance, ccy.currency) },
          ],
          fields: [
            { key: 'name', label: L.name, kind: 'text', value: name },
            { key: 'balance', label: L.openingBalance, kind: 'amount', value: String(balance), currency: ccy.currency },
          ],
          ...(duplicate ? { effect: L.duplicate } : {}),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = add_savings_account.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const def = POCKET_KINDS[a.kind as PocketKind]
    const id = fin().addSavingsAccount({
      name: a.name as string,
      category: 'savings',
      type: def.savingsType,
      currency: a.currency as Currency,
      openingBalance: (a.balance as number | undefined) ?? 0,
      color: def.color,
      icon: def.icon,
    })
    return { ok: true, message: a.name as string, undo: () => fin().deleteSavingsAccount(id) }
  },
}

type Mode = 'allocate' | 'declare'

interface Move {
  pocket: SavingsAccount
  amount: number
  currency: Currency
  landed: number
}

function planMove(args: Record<string, unknown>): Move | Refusal {
  const s = fin()
  const hit = pocketOf(s, args.pocket)
  if ('error' in hit) return hit.error
  const amount = num(args.amount)
  if (amount === undefined || amount <= 0) return no('The amount must be above zero.')
  const ccy = enabledCurrency(s, args.currency)
  if ('error' in ccy) return ccy.error
  const landed = inPocketCurrency(s, amount, ccy.currency, hit.item)
  if ('error' in landed) return no(landed.error)
  return { pocket: hit.item, amount, currency: ccy.currency, landed: landed.amount }
}

const amountField = (key: string, label: string, amount: number, currency: Currency): EditableField => ({ key, label, kind: 'amount', value: String(amount), currency })

const deposit_to_savings: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const m = planMove(args)
    if ('ok' in m) return m
    if (args.mode !== undefined && args.mode !== 'allocate' && args.mode !== 'declare') return no('mode must be allocate or declare.')
    const mode: Mode = args.mode === 'declare' ? 'declare' : 'allocate'
    const { pocket, amount, currency, landed } = m
    const inBase = tryConvertCurrency(amount, currency, s.settings.baseCurrency, s.exchangeRates)
    const goals = goalNames(s, pocket.id)
    const rows: PreviewRow[] = [
      { label: L.pocket, value: pocket.name },
      { label: L.amount, value: money(amount, currency) },
      ...(currency !== pocket.currency ? [{ label: L.arrivesAs, value: money(r2(landed), pocket.currency) }] : []),
      { label: L.source, value: L.sources[mode] },
      { label: L.balance, before: money(pocket.currentBalance, pocket.currency), value: money(pocket.currentBalance + landed, pocket.currency) },
    ]
    const note = text(args.note, 80)
    return ok(
      makeProposal({
        tool: 'deposit_to_savings',
        args: { pocket: refOf(pocket.id), amount, currency, mode, ...(note ? { note } : {}) },
        risk: 'approve',
        summary: `Pending approval: add ${money(amount, currency)} to ${pocket.name}.`,
        preview: {
          domain: 'savings',
          tone: 'add',
          title: L.deposit,
          rows,
          fields: [
            amountField('amount', L.amount, amount, currency),
            { key: 'mode', label: L.source, kind: 'select', value: mode, options: (['allocate', 'declare'] as const).map((v) => ({ value: v, label: L.sources[v] })) },
          ],
          effect: [mode === 'allocate' ? L.allocateEffect(inBase === null ? money(amount, currency) : money(inBase, s.settings.baseCurrency)) : L.declareEffect, goals ? L.goalsAffected(goals) : ''].filter(Boolean).join(' '),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = deposit_to_savings.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const target = pocketOf(fin(), a.pocket)
    if ('error' in target) return { ok: false, error: 'That pocket no longer exists.' }
    const before = snapshotLedger()
    fin().depositToSavings(target.item.id, a.amount as number, a.currency as Currency, a.note as string | undefined, { mode: a.mode as Mode })
    if (!posted(before)) return { ok: false, error: 'The deposit was not recorded.' }
    return { ok: true, message: `${target.item.name} · ${money(a.amount as number, a.currency as string)}`, undo: ledgerUndo(before) }
  },
}

const withdraw_from_savings: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const purpose = args.purpose
    if (purpose === 'debt') return no('Paying a debt from savings is not available here.', 'Use the debt payment tool instead.')
    if (purpose === 'transfer') return no('Moving money to another pocket is a transfer.', 'Use transfer_between_pockets.')
    if (purpose !== 'income' && purpose !== 'spend') return no('purpose must be income or spend.', 'Ask whether the money becomes this month income or was spent.')
    const m = planMove(args)
    if ('ok' in m) return m
    const { pocket, amount, currency, landed } = m
    if (pocket.currentBalance + 0.0001 < landed) {
      return no(`${pocket.name} only holds ${money(pocket.currentBalance, pocket.currency)}.`, 'Ask for a smaller amount.')
    }
    const goals = goalNames(s, pocket.id)
    const inBase = tryConvertCurrency(amount, currency, s.settings.baseCurrency, s.exchangeRates)
    const note = text(args.note, 80)
    return ok(
      makeProposal({
        tool: 'withdraw_from_savings',
        args: { pocket: refOf(pocket.id), amount, currency, purpose, ...(note ? { note } : {}) },
        risk: 'approve',
        summary: `Pending approval: take ${money(amount, currency)} out of ${pocket.name}.`,
        preview: {
          domain: 'savings',
          tone: 'change',
          title: L.withdraw,
          rows: [
            { label: L.pocket, value: pocket.name },
            { label: L.amount, value: money(amount, currency) },
            { label: L.purpose, value: L.purposes[purpose] },
            { label: L.balance, before: money(pocket.currentBalance, pocket.currency), value: money(Math.max(0, pocket.currentBalance - landed), pocket.currency) },
          ],
          fields: [amountField('amount', L.amount, amount, currency)],
          effect: [purpose === 'income' ? L.incomeEffect(inBase === null ? money(amount, currency) : money(inBase, s.settings.baseCurrency)) : L.spendEffect, goals ? L.goalsAffected(goals) : ''].filter(Boolean).join(' '),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = withdraw_from_savings.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const target = pocketOf(fin(), a.pocket)
    if ('error' in target) return { ok: false, error: 'That pocket no longer exists.' }
    const before = snapshotLedger()
    fin().withdrawFromSavings(target.item.id, a.amount as number, a.currency as Currency, a.note as string | undefined, a.purpose as 'income' | 'spend')
    if (!posted(before)) return { ok: false, error: 'The withdrawal was not recorded.' }
    return { ok: true, message: `${target.item.name} · ${money(a.amount as number, a.currency as string)}`, undo: ledgerUndo(before) }
  },
}

const transfer_between_pockets: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const from = pocketOf(s, args.from)
    if ('error' in from) return from.error
    const to = pocketOf(s, args.to)
    if ('error' in to) return to.error
    if (from.item.id === to.item.id) return no('The two pockets must be different.')
    const amount = num(args.amount)
    if (amount === undefined || amount <= 0) return no('The amount must be above zero.')
    const a = from.item
    const b = to.item
    if (a.currentBalance + 0.0001 < amount) return no(`${a.name} only holds ${money(a.currentBalance, a.currency)}.`, 'Ask for a smaller amount.')
    const arrives = a.currency === b.currency ? amount : tryConvertCurrency(amount, a.currency, b.currency, s.exchangeRates)
    if (arrives === null || arrives <= 0) {
      return no(`There is no exchange path from ${a.currency} to ${b.currency}. Buying into that pocket is not a transfer.`)
    }
    const goals = goalNames(s, a.id, b.id)
    const note = text(args.note, 80)
    return ok(
      makeProposal({
        tool: 'transfer_between_pockets',
        args: { from: refOf(a.id), to: refOf(b.id), amount, ...(note ? { note } : {}) },
        risk: 'approve',
        summary: `Pending approval: move ${money(amount, a.currency)} from ${a.name} to ${b.name}.`,
        preview: {
          domain: 'savings',
          tone: 'change',
          title: L.transfer,
          rows: [
            { label: L.from, value: a.name, before: money(a.currentBalance, a.currency) },
            { label: L.to, value: b.name, before: money(b.currentBalance, b.currency) },
            { label: L.amount, value: money(amount, a.currency) },
            ...(a.currency !== b.currency ? [{ label: L.arrivesAs, value: money(r2(arrives), b.currency) }] : []),
          ],
          fields: [amountField('amount', L.amount, amount, a.currency)],
          effect: [L.moveEffect, goals ? L.goalsAffected(goals) : ''].filter(Boolean).join(' '),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = transfer_between_pockets.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const s = fin()
    const from = pocketOf(s, a.from)
    const to = pocketOf(s, a.to)
    if ('error' in from || 'error' in to) return { ok: false, error: 'That pocket no longer exists.' }
    const before = snapshotLedger()
    s.transferBetweenPockets(from.item.id, to.item.id, a.amount as number, a.note as string | undefined)
    if (!posted(before)) return { ok: false, error: 'The transfer was not recorded.' }
    return { ok: true, message: `${from.item.name} → ${to.item.name}`, undo: ledgerUndo(before) }
  },
}

const correct_savings_balance: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const hit = pocketOf(s, args.pocket)
    if ('error' in hit) return hit.error
    const p = hit.item
    const balance = num(args.balance)
    if (balance === undefined || balance < 0) return no('The balance cannot be negative.')
    if (Math.abs(balance - p.currentBalance) < 0.0001) return no(`${p.name} already holds that amount.`)
    const note = text(args.note, 80)
    return ok(
      makeProposal({
        tool: 'correct_savings_balance',
        args: { pocket: refOf(p.id), balance, ...(note ? { note } : {}) },
        risk: 'approve',
        summary: `Pending approval: set ${p.name} to ${money(balance, p.currency)}.`,
        preview: {
          domain: 'savings',
          tone: 'change',
          title: `${L.correct}: ${p.name}`,
          rows: [{ label: L.balance, before: money(p.currentBalance, p.currency), value: money(balance, p.currency) }],
          fields: [amountField('balance', L.balance, balance, p.currency)],
          effect: [L.correctEffect, goalNames(s, p.id) ? L.goalsAffected(goalNames(s, p.id)) : ''].filter(Boolean).join(' '),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = correct_savings_balance.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const a = again.proposal.args
    const target = pocketOf(fin(), a.pocket)
    if ('error' in target) return { ok: false, error: 'That pocket no longer exists.' }
    const before = snapshotLedger()
    fin().correctSavingsBalance(target.item.id, a.balance as number, a.note as string | undefined)
    if (!posted(before)) return { ok: false, error: 'The correction was not recorded.' }
    return { ok: true, message: `${target.item.name} · ${money(a.balance as number, target.item.currency)}`, undo: ledgerUndo(before) }
  },
}

const delete_savings_account: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const hit = pocketOf(s, args.pocket)
    if ('error' in hit) return hit.error
    const p = hit.item
    const verdict = canDeletePocket(s, p.id)
    if (!verdict.ok) {
      return verdict.reason === 'default'
        ? no(`${p.name} receives the monthly savings, so it cannot be deleted yet.`, 'Make another pocket the default for monthly savings first.')
        : no(`${p.name} is your only pocket, so it cannot be deleted.`, 'At least one pocket is needed for monthly savings. Add another first.')
    }
    const entries = s.savingsTransactions.filter((t) => t.accountId === p.id).length
    const scheduled = s.recurringSavingsDeposits.filter((r) => r.accountId === p.id).length
    const goals = goalNames(s, p.id)
    const base = tryConvertCurrency(p.currentBalance, p.currency, s.settings.baseCurrency, s.exchangeRates)
    return ok(
      makeProposal({
        tool: 'delete_savings_account',
        args: { pocket: refOf(p.id) },
        risk: 'strong',
        summary: `Pending approval: delete pocket ${p.name}.`,
        preview: {
          domain: 'savings',
          tone: 'danger',
          title: `${L.deletePocket}: ${p.name}`,
          rows: [
            { label: L.balance, value: money(p.currentBalance, p.currency) },
            { label: L.history, value: String(entries) },
            ...(scheduled > 0 ? [{ label: L.scheduled, value: String(scheduled) }] : []),
          ],
          effect: [L.deleteEffect(entries, money(base ?? p.currentBalance, base === null ? p.currency : s.settings.baseCurrency)), goals ? L.unlinkGoals(goals) : ''].filter(Boolean).join(' '),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = delete_savings_account.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = pocketOf(fin(), again.proposal.args.pocket)
    if ('error' in hit) return { ok: false, error: 'That pocket no longer exists.' }
    const id = hit.item.id
    const { savingsAccounts, savingsTransactions, recurringSavingsDeposits, goals } = fin()
    const wasDefault = fin().profile.defaultCarryPocketId === id
    fin().deleteSavingsAccount(id)
    const afterGoals = fin().goals
    return {
      ok: true,
      message: hit.item.name,
      undo: () =>
        useFinanceStore.setState((st) => {
          const relinked = revertRows(st.goals, goals, afterGoals).map((g) =>
            goals.find((x) => x.id === g.id)?.linkedSavingsAccountIds.includes(id) && !g.linkedSavingsAccountIds.includes(id)
              ? { ...g, linkedSavingsAccountIds: [...g.linkedSavingsAccountIds, id] }
              : g,
          )
          return {
            savingsAccounts: restoreRows(st.savingsAccounts, savingsAccounts, new Set([id])),
            savingsTransactions: restoreRows(st.savingsTransactions, savingsTransactions, new Set(savingsTransactions.filter((t) => t.accountId === id).map((t) => t.id))),
            recurringSavingsDeposits: restoreRows(st.recurringSavingsDeposits, recurringSavingsDeposits, new Set(recurringSavingsDeposits.filter((r) => r.accountId === id).map((r) => r.id))),
            goals: relinked,
            ...(wasDefault ? { profile: { ...st.profile, defaultCarryPocketId: id } } : {}),
          }
        }),
    }
  },
}

type NewHolding = Omit<InvestmentHolding, 'id' | 'createdAt' | 'updatedAt'>

interface AssetPlan {
  holding: NewHolding
  grams: number | null
  unit: GoldUnit
  typedWorth?: { amount: number; currency: Currency }
}

function planAsset(args: Record<string, unknown>): AssetPlan | Refusal {
  const s = fin()
  const base = s.settings.baseCurrency
  const type = args.type as InvestmentAssetType
  if (!['gold', 'crypto', 'stock', 'property'].includes(type)) return no('type must be gold, crypto, stock or property.')
  const quantity = args.quantity === undefined ? undefined : num(args.quantity)
  const symbol = text(args.symbol, 12)?.toUpperCase()
  const paid = args.paid === undefined ? undefined : num(args.paid)
  if (args.paid !== undefined && (paid === undefined || paid < 0)) return no('The amount paid cannot be negative.')
  const purchaseDate = args.date === undefined ? undefined : (parseIsoDate(args.date) ?? undefined)
  if (args.date !== undefined && !purchaseDate) return no('The date must be a real date like 2026-10-19.')

  if (type === 'property') {
    const value = num(args.value)
    if (value === undefined || value <= 0) return no('A property needs its worth above zero.')
    const size = args.size === undefined ? 0 : num(args.size)
    if (size === undefined || size < 0) return no('The size cannot be negative.')
    const worth = typedWorthInEgp(s, value)
    if ('error' in worth) return worth.error
    return {
      grams: null,
      unit: 'grams',
      typedWorth: { amount: value, currency: base },
      holding: { assetType: 'property', name: text(args.name, 40) ?? 'Property', quantity: size, propertyValue: worth.egp, sharePercent: 100, currency: 'EGP', ...(purchaseDate ? { purchaseDate } : {}) },
    }
  }
  if (quantity === undefined || quantity <= 0) return no('The quantity must be above zero.')
  const cost = (units: number) => (paid !== undefined && paid > 0 ? { unitCost: paid / units, costBasisCurrency: base } : {})
  const common = purchaseDate ? { purchaseDate } : {}

  if (type === 'gold') {
    const karat = Number(args.karat) as GoldKarat
    if (!KARATS.includes(karat)) return no('Gold needs a karat: 24, 22, 21 or 18.', 'Ask which karat.')
    if (args.unit !== undefined && !['grams', 'pounds', 'ounces'].includes(args.unit as string)) return no('unit must be grams, pounds or ounces.')
    const unit = (args.unit as GoldUnit | undefined) ?? 'grams'
    const grams = goldToGrams(quantity, unit)
    return {
      grams,
      unit,
      holding: { assetType: 'gold', name: text(args.name, 40) ?? `${karat}k gold`, karat, quantity: grams, goldUnit: unit, currency: 'EGP', ...cost(grams), ...common },
    }
  }
  if (!symbol) return no(type === 'crypto' ? 'A crypto asset needs its coin symbol, like BTC.' : 'A stock needs its ticker, like AAPL.')
  return {
    grams: null,
    unit: 'grams',
    holding: { assetType: type, name: text(args.name, 40) ?? symbol, symbol, quantity, currency: type === 'crypto' ? base : 'USD', ...cost(quantity), ...common },
  }
}

const add_investment_holding: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const plan = planAsset(args)
    if ('ok' in plan) return plan
    const h = plan.holding
    const live = holdingValueBase(s, { ...h, id: '', createdAt: '' })
    const rows: PreviewRow[] = [
      { label: L.type, value: L.assetTypes[h.assetType] },
      { label: L.name, value: h.name },
      ...(h.karat ? [{ label: L.karat, value: `${h.karat}k` }] : []),
      ...(h.symbol ? [{ label: L.symbol, value: h.symbol }] : []),
      ...(h.assetType === 'property'
        ? [
            { label: L.value, value: plan.typedWorth && plan.typedWorth.currency !== h.currency ? `${money(plan.typedWorth.amount, plan.typedWorth.currency)} = ${money(h.propertyValue as number, h.currency)}` : money(h.propertyValue as number, h.currency) },
            ...(h.quantity > 0 ? [{ label: L.size, value: String(h.quantity) }] : []),
          ]
        : [{ label: L.quantity, value: plan.grams !== null && plan.unit !== 'grams' ? `${num(args.quantity)} ${plan.unit} (${r2(plan.grams)} g)` : plan.grams !== null ? `${r2(plan.grams)} g` : String(h.quantity) }]),
      ...(h.unitCost !== undefined ? [{ label: L.paid, value: money(r2(h.unitCost * h.quantity), h.costBasisCurrency as string) }] : []),
      ...(h.purchaseDate ? [{ label: L.date, value: h.purchaseDate }] : []),
    ]
    const clean = { ...args, ...(h.symbol ? { symbol: h.symbol } : {}), ...(h.karat ? { karat: String(h.karat) } : {}) }
    return ok(
      makeProposal({
        tool: 'add_investment_holding',
        args: clean,
        risk: 'approve',
        summary: `Pending approval: add ${h.name}.`,
        preview: {
          domain: 'savings',
          tone: 'add',
          title: L.addAsset,
          rows,
          effect: live === null ? L.unpriced : L.worth(money(r0(live), s.settings.baseCurrency)),
        },
      }),
    )
  },
  apply(proposal) {
    const plan = planAsset(proposal.args)
    if ('ok' in plan) return { ok: false, error: plan.error }
    const h = plan.holding
    const twin = fin().investmentHoldings.some(
      (x) =>
        Date.now() - new Date(x.createdAt).getTime() < RECENT_MS &&
        x.assetType === h.assetType &&
        x.name === h.name &&
        x.symbol === h.symbol &&
        x.quantity === h.quantity &&
        x.propertyValue === h.propertyValue,
    )
    if (twin) return { ok: false, error: 'Already added' }
    const id = fin().addInvestmentHolding(plan.holding)
    return { ok: true, message: plan.holding.name, undo: () => fin().deleteInvestmentHolding(id) }
  },
}

interface AssetEdit {
  holding: InvestmentHolding
  patch: Partial<InvestmentHolding>
  rows: PreviewRow[]
}

function planAssetEdit(args: Record<string, unknown>, ctx: ToolContext): AssetEdit | Refusal {
  const s = fin()
  const L = savingsLabels(ctx.locale)
  const hit = assetOf(s, args.asset)
  if ('error' in hit) return hit.error
  const h = hit.item
  const patch: Partial<InvestmentHolding> = {}
  const rows: PreviewRow[] = []
  const name = text(args.name, 40)
  if (name && name !== h.name) {
    patch.name = name
    rows.push({ label: L.name, before: h.name, value: name })
  }
  if (args.quantity !== undefined) {
    if (h.assetType === 'property') return no('A property has a worth, not a quantity.', 'Send value instead.')
    const q = num(args.quantity)
    if (q === undefined || q <= 0) return no('The quantity must be above zero.')
    if (q !== h.quantity) {
      patch.quantity = q
      if (h.assetType === 'gold') patch.goldUnit = 'grams'
      rows.push({ label: L.quantity, before: String(h.quantity), value: String(q) })
    }
  }
  if (args.value !== undefined) {
    if (h.assetType !== 'property') return no('Only a property has a typed worth.', 'Send quantity instead.')
    const typed = num(args.value)
    if (typed === undefined || typed <= 0) return no('The worth must be above zero.')
    const worth = typedWorthInEgp(s, typed)
    if ('error' in worth) return worth.error
    if (worth.egp !== h.propertyValue) {
      patch.propertyValue = worth.egp
      patch.currency = 'EGP'
      rows.push({ label: L.value, before: money(h.propertyValue ?? 0, 'EGP'), value: money(worth.egp, 'EGP') })
    }
  }
  if (rows.length === 0) return no('Nothing would change.')
  return { holding: h, patch, rows }
}

const update_investment_holding: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const plan = planAssetEdit(args, ctx)
    if ('ok' in plan) return plan
    const after = holdingValueBase(s, { ...plan.holding, ...plan.patch })
    return ok(
      makeProposal({
        tool: 'update_investment_holding',
        args: { ...args, asset: refOf(plan.holding.id) },
        risk: 'approve',
        summary: `Pending approval: change ${plan.holding.name}.`,
        preview: {
          domain: 'savings',
          tone: 'change',
          title: `${L.changeAsset}: ${plan.holding.name}`,
          rows: plan.rows,
          effect: after === null ? L.unpriced : L.worth(money(r0(after), s.settings.baseCurrency)),
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const plan = planAssetEdit(proposal.args, ctx)
    if ('ok' in plan) return { ok: false, error: plan.error }
    const previous: Record<string, unknown> = {}
    for (const key of Object.keys(plan.patch) as (keyof InvestmentHolding)[]) previous[key] = plan.holding[key]
    const id = plan.holding.id
    fin().updateInvestmentHolding(id, plan.patch)
    return { ok: true, message: plan.patch.name ?? plan.holding.name, undo: () => fin().updateInvestmentHolding(id, previous as Partial<InvestmentHolding>) }
  },
}

const delete_investment_holding: WriteImpl = {
  propose(args, ctx) {
    const s = fin()
    const L = savingsLabels(ctx.locale)
    const hit = assetOf(s, args.asset)
    if ('error' in hit) return hit.error
    const h = hit.item
    const value = holdingValueBase(s, h)
    return ok(
      makeProposal({
        tool: 'delete_investment_holding',
        args: { asset: refOf(h.id) },
        risk: 'strong',
        summary: `Pending approval: delete asset ${h.name}.`,
        preview: {
          domain: 'savings',
          tone: 'danger',
          title: `${L.deleteAsset}: ${h.name}`,
          rows: [
            { label: L.type, value: L.assetTypes[h.assetType] },
            ...(value === null ? [] : [{ label: L.value, value: money(r0(value), s.settings.baseCurrency) }]),
          ],
        },
      }),
    )
  },
  apply(proposal, ctx) {
    const again = delete_investment_holding.propose(proposal.args, ctx)
    if (!again.ok) return { ok: false, error: again.error }
    const hit = assetOf(fin(), again.proposal.args.asset)
    if ('error' in hit) return { ok: false, error: 'That asset no longer exists.' }
    const before = fin().investmentHoldings
    fin().deleteInvestmentHolding(hit.item.id)
    return {
      ok: true,
      message: hit.item.name,
      undo: () => useFinanceStore.setState((st) => ({ investmentHoldings: restoreRows(st.investmentHoldings, before, new Set([hit.item.id])) })),
    }
  },
}

export const savingsTools = defineTools(savingsSpecs, {
  list_savings,
  get_net_worth,
  add_savings_account,
  deposit_to_savings,
  withdraw_from_savings,
  transfer_between_pockets,
  correct_savings_balance,
  delete_savings_account,
  add_investment_holding,
  update_investment_holding,
  delete_investment_holding,
})
