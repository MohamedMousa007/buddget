'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Lightbulb, Search, SquarePen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { groupChats, searchChats, type SavedChat } from '@/lib/buddgy/client/savedChats'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'

export interface AIChatListProps {
  chats: SavedChat[]
  activeId: string | null
  onOpen: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onBack: () => void
  onMemory: () => void
}

/** The chats saved on this phone, inside the Buddgy pop-up, like the chat list in ChatGPT and Claude (BDG-013). */
export function AIChatList({ chats, activeId, onOpen, onNew, onDelete, onBack, onMemory }: AIChatListProps) {
  const all = useBuddgyChatCopy()
  const copy = all.list
  const confirm = useConfirm()
  const [query, setQuery] = useState('')
  const groups = useMemo(() => groupChats(searchChats(chats, query), new Date()), [chats, query])

  const askDelete = async (chat: SavedChat) => {
    const title = chat.title || copy.untitled
    if (await confirm({ title: copy.deleteTitle, body: copy.deleteBody(title), confirmLabel: copy.deleteConfirm, destructive: true })) onDelete(chat.id)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-brand-border)] px-3 py-2">
        <IconButton onClick={onBack} aria-label={copy.back} variant="ghost" size="sm" shape="round">
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </IconButton>
        <h3 className="flex-1 text-center text-base font-bold text-[var(--color-brand-text-primary)]">{copy.title}</h3>
        <span className="w-11" aria-hidden />
      </div>

      <div className="flex flex-col gap-2 px-4 pt-3">
        <Button size="touch" onClick={onNew} className="w-full">
          <SquarePen aria-hidden />
          {all.newChat}
        </Button>
        <label className="relative block">
          <span className="sr-only">{copy.search}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-brand-text-muted)]" aria-hidden />
          <Input size="brand" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={copy.search} className="ps-9" />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-[var(--color-brand-text-muted)]">{chats.length === 0 ? copy.empty : copy.noMatch}</p>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-label={copy.groups[g.key]}>
              <h4 className="px-3 pb-1 pt-4 text-xs font-semibold text-[var(--color-brand-text-muted)]">{copy.groups[g.key]}</h4>
              <ul className="flex flex-col gap-0.5">
                {g.chats.map((c) => {
                  const title = c.title || copy.untitled
                  return (
                    <li key={c.id} className={`flex items-center rounded-xl ${c.id === activeId ? 'bg-[var(--color-brand-elevated)]' : ''}`}>
                      <button
                        type="button"
                        data-raw-button-ok="a full-width list row that opens a chat; Button would centre and pad it"
                        onClick={() => onOpen(c.id)}
                        aria-current={c.id === activeId ? 'true' : undefined}
                        className="min-h-12 min-w-0 flex-1 truncate px-3 text-start text-sm text-[var(--color-brand-text-primary)]"
                      >
                        {title}
                      </button>
                      <IconButton onClick={() => void askDelete(c)} aria-label={copy.remove(title)} variant="ghost" size="sm" shape="round">
                        <Trash2 className="h-4 w-4 text-[var(--color-brand-text-muted)]" />
                      </IconButton>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <button
        type="button"
        data-raw-button-ok="a two-line settings row with a chevron, the same shape as the settings list rows"
        onClick={onMemory}
        className="mx-4 mb-3 flex min-h-14 items-center gap-3 border-t border-[var(--color-brand-border)] px-1 text-start"
      >
        <Lightbulb className="h-5 w-5 shrink-0 text-[var(--color-brand-primary-ink)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--color-brand-text-primary)]">{copy.memory}</span>
          <span className="block text-xs text-[var(--color-brand-text-muted)]">{copy.memoryHint}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
      </button>
    </div>
  )
}
