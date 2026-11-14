import { describe, expect, it } from 'vitest'
import { accountBankFrom, decideProvider, evidenceBank, formatVotesFrom, historyBanksFrom, type ProviderEvidence } from './providerCascade'

// Synthetic messages only.
const ev = (over: Partial<ProviderEvidence> = {}): ProviderEvidence => ({
  sender: null, body: 'Purchase of 100.00 on card ****1234', fromCodePattern: false, parsedBankName: null, historyBanks: [], formatVotes: {}, ...over,
})

describe('decideProvider', () => {
  it('takes the most certain stage and records which one it was', () => {
    expect(decideProvider(ev({ sender: 'CIB' }))).toMatchObject({ bankKey: 'cib', stage: 'sender' })
    expect(decideProvider(ev({ fromCodePattern: true, parsedBankName: 'NBE' }))).toMatchObject({ bankKey: 'nbe', stage: 'pattern' })
    expect(decideProvider(ev({ body: 'Purchase of 100.00. For details call 19666' }))).toMatchObject({ bankKey: 'cib', stage: 'body' })
    expect(decideProvider(ev({ historyBanks: ['nbe', 'nbe'] }))).toMatchObject({ bankKey: 'nbe', stage: 'history' })
  })

  it('a bank printed in the body outranks the history of the digits', () => {
    expect(decideProvider(ev({ body: 'CIB: purchase of 100.00', historyBanks: ['nbe'] }))).toMatchObject({ bankKey: 'cib', stage: 'body' })
  })

  it('does not take a bank named in the middle of a transfer or cash-machine message for the sender', () => {
    const body = 'Cash withdrawal of 500.00 at HSBC machine'
    expect(decideProvider(ev({ body, kind: 'atm_withdrawal' })).stage).toBeNull()
    expect(decideProvider(ev({ body, kind: 'purchase' }))).toMatchObject({ bankKey: 'hsbceg', stage: 'body' })
    // An opening signature and a hotline are the sender whatever the kind.
    expect(decideProvider(ev({ body: 'HSBC: cash withdrawal of 500.00', kind: 'atm_withdrawal' }))).toMatchObject({ stage: 'body' })
    expect(decideProvider(ev({ body: `${body}. Call 19666`, kind: 'atm_withdrawal' }))).toMatchObject({ bankKey: 'cib', stage: 'body' })
  })

  it('drops the history mapping as soon as a second bank appears', () => {
    expect(decideProvider(ev({ historyBanks: ['nbe', 'cib'] }))).toMatchObject({ bankKey: null, stage: null })
  })

  it('lets a format name the bank only with three distinct users and nothing contradicting', () => {
    expect(decideProvider(ev({ formatVotes: { nbe: 3 } }))).toMatchObject({ bankKey: 'nbe', stage: 'format' })
    expect(decideProvider(ev({ formatVotes: { nbe: 2 } }))).toEqual({ bankKey: null, stage: null, suggestion: 'nbe', suggestionSource: 'format' })
    expect(decideProvider(ev({ formatVotes: { nbe: 5, cib: 1 } }))).toEqual({ bankKey: null, stage: null, suggestion: null, suggestionSource: null })
  })

  it("never lets the AI's guess set the bank: it only pre-fills the question", () => {
    expect(decideProvider(ev({ parsedBankName: 'NBE' }))).toEqual({ bankKey: null, stage: null, suggestion: 'nbe', suggestionSource: 'ai' })
  })

  it('names nothing when nothing is known', () => {
    expect(decideProvider(ev())).toEqual({ bankKey: null, stage: null, suggestion: null, suggestionSource: null })
  })
})

describe('evidence rows', () => {
  const row = (over: Record<string, unknown>) => ({ user_id: 'u1', sender: null, bank_name: null, bank_source: null, pattern_id: null, ...over })

  it('counts a bank only when a sender, a code pattern or the body named it', () => {
    expect(evidenceBank(row({ sender: 'CIB' }))).toBe('cib')
    expect(evidenceBank(row({ bank_name: 'NBE', bank_source: 'body' }))).toBe('nbe')
    expect(evidenceBank(row({ bank_name: 'NBE', pattern_id: 'nbe-x' }))).toBe('nbe')
    // Derived or guessed banks never become evidence, or one inference would confirm the next.
    expect(evidenceBank(row({ bank_name: 'NBE', bank_source: 'history' }))).toBeNull()
    expect(evidenceBank(row({ bank_name: 'NBE', bank_source: 'format' }))).toBeNull()
    expect(evidenceBank(row({ bank_name: 'NBE' }))).toBeNull()
  })

  it('lists the banks one set of digits was seen with', () => {
    expect(historyBanksFrom([row({ sender: 'CIB' }), row({ sender: 'CIB' }), row({ bank_name: 'NBE' })])).toEqual(['cib'])
  })

  it('counts distinct other users per bank, never the user themself', () => {
    const rows = [row({ user_id: 'a', sender: 'CIB' }), row({ user_id: 'a', sender: 'CIB' }), row({ user_id: 'b', sender: 'CIB' }), row({ user_id: 'me', sender: 'NBE' })]
    expect(formatVotesFrom(rows, 'me')).toEqual({ cib: 2 })
  })
})

describe("the user's own answer", () => {
  const accounts = [
    { id: 'a', name: 'NBE ••1234', last4: '1234', last4_aliases: [] },
    { id: 'p', name: 'CIB ••5678', last4: '5678', last4_aliases: [], provisional: true },
    { id: 'n', name: 'Account ••9999', last4: '9999', last4_aliases: [] },
  ]
  it('reads the bank from the confirmed account the digits name', () => {
    expect(accountBankFrom(accounts, '1234')).toBe('nbe')
  })
  it('ignores a provisional account and an account with no bank in its name', () => {
    expect(accountBankFrom(accounts, '5678')).toBeNull()
    expect(accountBankFrom(accounts, '9999')).toBeNull()
  })
  it('outranks history and format, and is itself evidence for other messages', () => {
    expect(decideProvider(ev({ accountBank: 'nbe', historyBanks: ['cib'], formatVotes: { cib: 9 } }))).toMatchObject({ bankKey: 'nbe', stage: 'account' })
    expect(evidenceBank({ user_id: 'u', sender: null, bank_name: 'NBE', bank_source: 'account', pattern_id: null })).toBe('nbe')
  })
})
