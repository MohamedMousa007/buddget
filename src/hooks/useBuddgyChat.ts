'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import type { BuddgyBeat, BuddgyItem, ChatError, ChatItem, ProposalState, ProposalStatus } from '@/lib/buddgy/client/chatTypes'
import { compressHistory } from '@/lib/buddgy/client/history'
import { runLocal } from '@/lib/buddgy/client/localTurn'
import { runTurn, TurnFailure } from '@/lib/buddgy/client/runTurn'
import { classifyIntent } from '@/lib/buddgy/local/classifyIntent'
import { PROPOSAL_TTL_MS, type Proposal } from '@/lib/buddgy/tools/proposal'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { buddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import { useLocale, useT } from '@/lib/i18n'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/** A chat left alone this long starts fresh: the next question is almost never about the last one. */
const IDLE_RESET_MS = 30 * 60 * 1000

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
  const abortRef = useRef<AbortController | null>(null)
  /** Read synchronously so two quick sends cannot both start; `busy` state lags a render. */
  const busyRef = useRef(false)
  /** Identifies the turn in flight, so a finished or cancelled turn never clears a newer one. */
  const turnSeqRef = useRef(0)
  const lastActivityRef = useRef(Date.now())
  const bottomRef = useRef<HTMLDivElement>(null)

  const commit = useCallback((next: ChatItem[]) => {
    itemsRef.current = next
    setItems(next)
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
    commit([])
    chatIdRef.current = null
    softRef.current = false
    turnSeqRef.current += 1
    busyRef.current = false
    setBusy(false)
    setStep(null)
    setBeat(null)
  }, [commit])

  useEffect(() => {
    if (!user && supabaseConfigured) newChat()
  }, [user, supabaseConfigured, newChat])

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
      const write = TOOLS.get(state.proposal.tool)?.write
      const result = write?.apply(state.proposal, { now: new Date(), locale })
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

  const reviseProposal = useCallback(
    (itemId: string, proposalId: string, patch: Record<string, string>) => {
      const state = findProposal(itemId, proposalId)
      if (!state) return
      const write = TOOLS.get(state.proposal.tool)?.write
      const result = write?.propose({ ...state.proposal.args, ...patch }, { now: new Date(), locale })
      if (!result?.ok) {
        setProposalState(itemId, proposalId, (s) => ({ ...s, message: result?.error }))
        return
      }
      setProposalState(itemId, proposalId, () => ({ proposal: result.proposal, status: 'pending' }))
    },
    [locale, setProposalState],
  )

  const finishWithProposals = useCallback(
    (itemId: string, proposals: Proposal[]) => {
      patchBuddgy(itemId, (it) => ({ ...it, proposals: proposals.map((proposal) => ({ proposal, status: 'pending' as const })) }))
      for (const p of proposals) if (p.risk === 'auto') applyProposal(itemId, p.id)
    },
    [applyProposal, patchBuddgy],
  )

  const send = useCallback(
    async (override?: string) => {
      const text = (override ?? input).trim()
      if (!text || busyRef.current) return
      if (!guardSignedIn()) return
      if (override === undefined) setInput('')

      if (Date.now() - lastActivityRef.current > IDLE_RESET_MS) {
        commit([])
        chatIdRef.current = null
        softRef.current = false
      }
      lastActivityRef.current = Date.now()

      const userItem: ChatItem = { id: newId(), role: 'user', text }
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
          locale,
          intent: classifyIntent(text),
          route: pathname,
          signal: controller.signal,
          now,
          onText: (partial) => patchBuddgy(replyId, (it) => ({ ...it, text: partial })),
          onStep: setStep,
          onChat: (id) => {
            if (turnSeqRef.current === seq) chatIdRef.current = id
          },
        })
        if (turnSeqRef.current !== seq) return
        chatIdRef.current = out.chatId
        softRef.current = out.soft
        patchBuddgy(replyId, (it) => ({ ...it, text: out.text, reads: out.reads, status: 'done', truncated: out.truncated }))
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
    const lastUser = [...list].reverse().find((i) => i.role === 'user')
    if (!lastUser) return
    const cut = list.findIndex((i) => i.id === lastUser.id)
    commit(list.slice(0, cut))
    void send(lastUser.text)
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
    applyProposal,
    dismissProposal,
    reviseProposal,
    undoApplied,
    bottomRef,
  }
}
