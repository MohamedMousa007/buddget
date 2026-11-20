'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { BuddgyBeat, BuddgyItem, ChatError, ChatItem, ProposalState, ProposalStatus, UserItem } from '@/lib/buddgy/client/chatTypes'
import { compressHistory } from '@/lib/buddgy/client/history'
import { forSaving, isStreaming, restoreItems, titleOf } from '@/lib/buddgy/client/savedChats'
import { useBuddgyChats } from '@/lib/store/useBuddgyChats'
import { runLocal } from '@/lib/buddgy/client/localTurn'
import { runTurn, TurnFailure } from '@/lib/buddgy/client/runTurn'
import { resetNavConsent } from '@/lib/buddgy/tools/navConsent'
import { classifyIntent } from '@/lib/buddgy/local/classifyIntent'
import { PROPOSAL_TTL_MS, type Proposal } from '@/lib/buddgy/tools/proposal'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { applyBatch, groupBatches, isBatch, removeBatchItem, replaceBatchItem } from '@/lib/buddgy/tools/batch'
import { reviseProposalArgs } from '@/lib/buddgy/tools/revise'
import { buddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import { useLocale, useT } from '@/lib/i18n'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useUsageStore } from '@/lib/usage/usageStore'

const newId = () => crypto.randomUUID()

type Updater = (item: BuddgyItem) => BuddgyItem

export function useBuddgyChat() {
  const { activeModal, setActiveModal, aiChatSeed, aiChatSeedSend, clearAiChatSeed } = useSettingsStore()
  const { user, openAuthModal } = useAuth()
  const { locale } = useLocale()
  const t = useT()
  const toast = useActionToast()
  const pathname = usePathname()
  const { online } = useNetworkStatus()
  const supabaseConfigured = useMemo(() => isSupabaseConfigured(), [])
  const isOpen = activeModal === 'aiChat'

  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<string | null>(null)
  const [beat, setBeat] = useState<BuddgyBeat | null>(null)

  const itemsRef = useRef<ChatItem[]>([])
  const chatIdRef = useRef<string | null>(null)
  const softRef = useRef(false)
  const taintedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  /** Read synchronously so two quick sends cannot both start; `busy` state lags a render. */
  const busyRef = useRef(false)
  /** Identifies the turn in flight, so a finished or cancelled turn never clears a newer one. */
  const turnSeqRef = useRef(0)
  /** This chat's id on the phone (BDG-013: chats are kept and reopened like ChatGPT and Claude); null until the first save. */
  const activeIdRef = useRef<string | null>(null)
  const createdAtRef = useRef(0)
  const chats = useBuddgyChats((s) => s.chats)
  const activeId = useBuddgyChats((s) => s.activeId)
  const bottomRef = useRef<HTMLDivElement>(null)

  const commit = useCallback((next: ChatItem[]) => {
    itemsRef.current = next
    setItems(next)
    // Saved once a reply has landed, never per streamed token.
    if (next.length === 0 || isStreaming(next)) return
    if (!activeIdRef.current) {
      activeIdRef.current = newId()
      createdAtRef.current = Date.now()
    }
    useBuddgyChats.getState().save({
      id: activeIdRef.current,
      serverChatId: chatIdRef.current,
      title: titleOf(next),
      createdAt: createdAtRef.current,
      updatedAt: Date.now(),
      items: forSaving(next),
      tainted: taintedRef.current,
    })
  }, [])

  const patchBuddgy = useCallback(
    (id: string, update: Updater) => {
      commit(itemsRef.current.map((i) => (i.id === id && i.role === 'buddgy' ? update(i) : i)))
    },
    [commit],
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items, step])

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    // BDG-015: a yes to move the user belongs to one chat.
    resetNavConsent()
    activeIdRef.current = null
    useBuddgyChats.getState().setActive(null)
    commit([])
    chatIdRef.current = null
    softRef.current = false
    taintedRef.current = false
    turnSeqRef.current += 1
    busyRef.current = false
    setBusy(false)
    setStep(null)
    setBeat(null)
  }, [commit])

  /** Opens a saved chat: it continues on the same server chat; a change left waiting is now out of date. */
  const openChat = useCallback(
    (id: string) => {
      const chat = useBuddgyChats.getState().chats.find((c) => c.id === id)
      if (!chat) return
      newChat()
      activeIdRef.current = chat.id
      createdAtRef.current = chat.createdAt
      chatIdRef.current = chat.serverChatId
      taintedRef.current = chat.tainted
      // Shown, not re-saved: looking at a chat must not move it to the top of the list.
      const restored = restoreItems(chat.items)
      itemsRef.current = restored
      setItems(restored)
      useBuddgyChats.getState().setActive(chat.id)
    },
    [newChat],
  )

  const deleteChat = useCallback(
    (id: string) => {
      const wasActive = activeIdRef.current === id
      useBuddgyChats.getState().remove(id)
      if (wasActive) newChat()
    },
    [newChat],
  )

  // The saved chats belong to whoever is signed in; on sign-in the last chat is reopened.
  const userId = user?.id ?? null
  useEffect(() => {
    if (!userId && supabaseConfigured) {
      newChat()
      return
    }
    const store = useBuddgyChats.getState()
    store.claim(userId)
    const last = store.activeId
    if (last && last !== activeIdRef.current) openChat(last)
  }, [userId, supabaseConfigured, newChat, openChat])

  const guardSignedIn = useCallback(() => {
    if (!supabaseConfigured || user) return true
    openAuthModal(pathname, t.ai.guardSignIn)
    return false
  }, [openAuthModal, pathname, supabaseConfigured, t, user])

  const setProposalState = useCallback(
    (itemId: string, proposalId: string, update: (s: ProposalState) => ProposalState) => {
      patchBuddgy(itemId, (it) => ({ ...it, proposals: it.proposals.map((p) => (p.proposal.id === proposalId ? update(p) : p)) }))
    },
    [patchBuddgy],
  )

  const findProposal = (itemId: string, proposalId: string): ProposalState | undefined => {
    const item = itemsRef.current.find((i) => i.id === itemId)
    return item?.role === 'buddgy' ? item.proposals.find((p) => p.proposal.id === proposalId) : undefined
  }

  const decide = useCallback(
    (itemId: string, proposalId: string, status: ProposalStatus, message?: string, undo?: () => void) =>
      setProposalState(itemId, proposalId, (s) => ({ ...s, status, message, undo })),
    [setProposalState],
  )

  const undoApplied = useCallback(
    (itemId: string, proposalId: string) => {
      const state = findProposal(itemId, proposalId)
      state?.undo?.()
      decide(itemId, proposalId, 'undone')
    },
    [decide],
  )

  const applyProposal = useCallback(
    (itemId: string, proposalId: string) => {
      const state = findProposal(itemId, proposalId)
      if (!state || state.status !== 'pending') return
      const copy = buddgyChatCopy[locale]
      if (Date.now() - state.proposal.createdAt > PROPOSAL_TTL_MS) {
        decide(itemId, proposalId, 'stale', copy.statuses.stale)
        return
      }
      const ctx = { now: new Date(), locale, revising: true }
      const result = isBatch(state.proposal) ? applyBatch(state.proposal, ctx) : TOOLS.get(state.proposal.tool)?.write?.apply(state.proposal, ctx)
      if (!result?.ok) {
        decide(itemId, proposalId, 'failed', result?.error)
        return
      }
      decide(itemId, proposalId, 'applied', result.message, result.undo)
      setBeat({ mood: 'done', at: Date.now() })
      toast(result.message, result.undo ? { undo: () => undoApplied(itemId, proposalId), undoLabel: copy.undo } : undefined)
    },
    [decide, locale, toast, undoApplied],
  )

  const dismissProposal = useCallback((itemId: string, proposalId: string) => decide(itemId, proposalId, 'dismissed'), [decide])

  /** "Try again" on a card that could not apply: back to pending, then the same re-checked apply. */
  const retryProposal = useCallback(
    (itemId: string, proposalId: string) => {
      if (findProposal(itemId, proposalId)?.status !== 'failed') return
      decide(itemId, proposalId, 'pending')
      applyProposal(itemId, proposalId)
    },
    [applyProposal, decide],
  )

  /** `rowKey` revises one row of a batch card; the rest of the batch stays as it is. */
  const reviseProposal = useCallback(
    (itemId: string, proposalId: string, patch: Record<string, string>, rowKey?: string) => {
      const state = findProposal(itemId, proposalId)
      if (!state) return
      const target = rowKey ? state.proposal.preview.items?.find((r) => r.key === rowKey)?.proposal : state.proposal
      if (!target) return
      const result = reviseProposalArgs(target, patch, { now: new Date(), locale })
      if (!result?.ok) {
        setProposalState(itemId, proposalId, (s) => ({ ...s, message: result?.error }))
        return
      }
      const next = rowKey ? replaceBatchItem(state.proposal, rowKey, result.proposal, locale) : result.proposal
      setProposalState(itemId, proposalId, () => ({ proposal: next, status: 'pending' }))
    },
    [locale, setProposalState],
  )

  const removeBatchRow = useCallback(
    (itemId: string, proposalId: string, rowKey: string) =>
      setProposalState(itemId, proposalId, (s) => (s.status === 'pending' && isBatch(s.proposal) ? { ...s, proposal: removeBatchItem(s.proposal, rowKey, locale) } : s)),
    [locale, setProposalState],
  )

  const finishWithProposals = useCallback(
    (itemId: string, proposals: Proposal[]) => {
      // Grouped before the auto pass: rows of a batch are added together, on one tap, never one by one.
      const cards = groupBatches(proposals, locale)
      patchBuddgy(itemId, (it) => ({ ...it, proposals: cards.map((proposal) => ({ proposal, status: 'pending' as const })) }))
      for (const p of cards) if (p.risk === 'auto') applyProposal(itemId, p.id)
    },
    [applyProposal, locale, patchBuddgy],
  )

  const send = useCallback(
    async (override?: string, opts?: { voice?: boolean; turnId?: string }) => {
      const text = (override ?? input).trim()
      if (!text || busyRef.current) return
      if (!guardSignedIn()) return
      if (override === undefined) setInput('')

      const turnId = opts?.turnId ?? crypto.randomUUID()
      const userItem: ChatItem = { id: newId(), role: 'user', text, turnId, ...(opts?.voice ? { voice: true } : {}) }
      const replyId = newId()
      const base: BuddgyItem = { id: replyId, role: 'buddgy', text: '', proposals: [], reads: [], status: 'streaming' }
      const prior = itemsRef.current
      commit([...prior, userItem, base])

      const now = new Date()
      const local = runLocal(text, locale, now)
      if (local) {
        if (local.kind === 'answer') {
          patchBuddgy(replyId, (it) => ({ ...it, text: local.text, reads: local.reads, status: 'done', local: true }))
        } else {
          patchBuddgy(replyId, (it) => ({ ...it, text: local.text, status: 'done', local: true }))
          finishWithProposals(replyId, local.proposals)
          // "Got it." must not stand next to a card that says it could not apply.
          patchBuddgy(replyId, (it) => (it.proposals.some((p) => p.status === 'failed') ? { ...it, text: '' } : it))
        }
        setBeat({ mood: 'happy', at: Date.now() })
        return
      }

      if (!online) {
        patchBuddgy(replyId, (it) => ({ ...it, status: 'error', error: { kind: 'offline' } }))
        setBeat({ mood: 'worried', at: Date.now() })
        return
      }

      const controller = new AbortController()
      abortRef.current = controller
      const seq = ++turnSeqRef.current
      busyRef.current = true
      setBusy(true)
      const { messages, carry } = compressHistory(prior, softRef.current)
      try {
        const out = await runTurn({
          text,
          history: messages,
          carry,
          chatId: chatIdRef.current,
          turnId,
          locale,
          intent: classifyIntent(text),
          route: pathname,
          signal: controller.signal,
          now,
          tainted: taintedRef.current,
          onText: (partial) => patchBuddgy(replyId, (it) => ({ ...it, text: partial })),
          onStep: setStep,
          onChat: (id) => {
            if (turnSeqRef.current === seq) chatIdRef.current = id
          },
        })
        if (turnSeqRef.current !== seq) return
        chatIdRef.current = out.chatId
        softRef.current = out.soft
        // The Advisor answered (Pro, trial, or the free one): the trial's day-3 nudge for it is no longer needed.
        if (out.intent === 'advice' && out.advisor !== 'locked') useUsageStore.getState().setSignal('advisorUsed', true)
        if (out.reads.length > 0) taintedRef.current = true
        patchBuddgy(replyId, (it) => ({ ...it, text: out.text, reads: out.reads, status: 'done', truncated: out.truncated, advisor: out.advisor, mode: out.mode, longChat: out.soft }))
        finishWithProposals(replyId, out.proposals)
        setBeat({ mood: out.proposals.length > 0 ? 'awake' : 'happy', at: Date.now() })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          patchBuddgy(replyId, (it) => ({ ...it, status: 'done' }))
        } else {
          const error: ChatError = e instanceof TurnFailure ? e.detail : { kind: 'failed' }
          patchBuddgy(replyId, (it) => ({ ...it, status: 'error', error }))
          setBeat({ mood: 'error', at: Date.now() })
        }
      } finally {
        if (turnSeqRef.current === seq) {
          abortRef.current = null
          busyRef.current = false
          setBusy(false)
          setStep(null)
        }
      }
    },
    [commit, finishWithProposals, guardSignedIn, input, locale, online, pathname, patchBuddgy],
  )

  const stop = useCallback(() => abortRef.current?.abort(), [])

  const retry = useCallback(() => {
    const list = itemsRef.current
    const lastUser = [...list].reverse().find((i): i is UserItem => i.role === 'user')
    if (!lastUser) return
    const cut = list.findIndex((i) => i.id === lastUser.id)
    commit(list.slice(0, cut))
    // Same turn id: a turn the server already charged gets one free re-run instead of a second charge.
    void send(lastUser.text, lastUser.turnId ? { turnId: lastUser.turnId } : undefined)
  }, [commit, send])

  const keepGoing = useCallback(() => void send(t.inlineCopy.buddgyContinue), [t, send])

  // A seed either pre-fills the composer (voice "Open in chat") or, from a Buddgy tip, is sent straight away.
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  }, [send])
  useEffect(() => {
    if (!isOpen || !aiChatSeed) return
    if (aiChatSeedSend) void sendRef.current(aiChatSeed)
    else setInput(aiChatSeed)
    clearAiChatSeed()
  }, [isOpen, aiChatSeed, aiChatSeedSend, clearAiChatSeed])

  return {
    isOpen,
    close: () => setActiveModal(null),
    items,
    input,
    setInput,
    busy,
    step,
    beat,
    online,
    send,
    stop,
    retry,
    keepGoing,
    newChat,
    chats,
    activeId,
    openChat,
    deleteChat,
    applyProposal,
    dismissProposal,
    retryProposal,
    reviseProposal,
    removeBatchRow,
    undoApplied,
    bottomRef,
  }
}
