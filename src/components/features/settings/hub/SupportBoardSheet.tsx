'use client'

import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { IconButton } from '@/components/ui/IconButton'
import { apiFetchAuth } from '@/lib/apiBase'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

type Item = { number: number; title: string; summary: string; state: string; votes: number; mine: number }

/** Ideas staff have published. Each person has one vote per idea: up, down, or none. */
export function SupportBoardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const copy = useSettingsHubCopy()
  const h = copy.help
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    if (!open) return
    void apiFetchAuth('/api/support/board', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: Item[] }) => setItems(d.items))
      .catch(() => setItems([]))
  }, [open])

  const vote = async (item: Item, value: 1 | -1) => {
    const next = item.mine === value ? 0 : value
    const prev = items
    setItems((cur) => cur?.map((i) => (i.number === item.number ? { ...i, mine: next, votes: i.votes - i.mine + next } : i)) ?? cur)
    try {
      const res = await apiFetchAuth(`/api/support/board/${item.number}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: next }) })
      if (!res.ok) throw new Error()
      const d = (await res.json()) as { votes: number }
      setItems((cur) => cur?.map((i) => (i.number === item.number ? { ...i, votes: d.votes } : i)) ?? cur)
    } catch {
      setItems(prev)
    }
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <V3SheetHeader title={h.board} onClose={onClose} />
        {items && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-brand-text-muted)]">{h.boardEmpty}</p>
        ) : (
          <ul className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto">
            {(items ?? []).map((item) => (
              <li key={item.number} className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand-border)] p-3">
                <div className="flex shrink-0 flex-col items-center">
                  <IconButton onClick={() => { void vote(item, 1) }} aria-label={h.upvote} aria-pressed={item.mine === 1} variant={item.mine === 1 ? 'tinted' : 'ghost'} size="sm" shape="round"><ChevronUp className="h-full w-full" /></IconButton>
                  <span className="font-mono-numbers text-sm font-semibold text-[var(--color-brand-text-primary)]">{item.votes}</span>
                  <IconButton onClick={() => { void vote(item, -1) }} aria-label={h.downvote} aria-pressed={item.mine === -1} variant={item.mine === -1 ? 'tinted' : 'ghost'} size="sm" shape="round"><ChevronDown className="h-full w-full" /></IconButton>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{item.title}</p>
                  {item.summary ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{item.summary}</p> : null}
                  {item.state !== 'published' ? <p className="mt-1 text-xs font-medium text-[var(--color-brand-primary)]">{h.boardState[item.state] ?? item.state}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}
