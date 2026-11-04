'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { BuddgyStatus } from '@/components/features/goals/new/BuddgyStatus'
import { GoalDraftCard } from '@/components/features/goals/new/GoalDraftCard'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import type { useNewGoalForm } from '@/hooks/useNewGoalForm'
import { useT } from '@/lib/i18n'
import { goalChatTurn, type ChatMsg } from '@/lib/goals/goalChat'
import { cn } from '@/lib/utils'

type Form = ReturnType<typeof useNewGoalForm>
interface Msg extends ChatMsg {
  chips?: string[]
}

const num = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 0)

/**
 * Talking a goal through with Buddgy. Each turn can change the amount, the date or the name, and the
 * goal card above the conversation is the same card the Goals page will show, updating as they talk.
 */
export function GoalChat({ form, firstText, onContinue, onManual }: { form: Form; firstText: string | null; onContinue: () => void; onManual: () => void }) {
  const t = useT().goals.flow
  const [msgs, setMsgs] = useState<Msg[]>(() => [firstText ? { role: 'user', text: firstText } : { role: 'buddgy', text: t.chat.greeting }])
  const [busy, setBusy] = useState(Boolean(firstText))
  const [failed, setFailed] = useState(false)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  const history = useRef<Msg[]>(msgs)
  history.current = msgs

  const draftNow = () => ({
    category: form.category, name: form.name || 'My goal', target: num(form.targetAmount) || undefined, date: form.targetDate,
  })

  const ask = async (thread: Msg[]) => {
    const ctrl = new AbortController()
    const giveUp = setTimeout(() => ctrl.abort(), 30_000)
    try {
      const turn = await goalChatTurn({ history: thread, draft: draftNow(), currency: form.currency, usualKeep: form.usualKeep, now: form.now }, ctrl.signal)
      form.applyDraft(turn.draft)
      setMsgs([...thread, { role: 'buddgy', text: turn.reply, chips: turn.chips }])
      setFailed(false)
    } catch {
      setFailed(true)
    } finally {
      clearTimeout(giveUp)
      setBusy(false)
    }
  }

  useEffect(() => {
    if (started.current || !firstText) return
    started.current = true
    void ask(history.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the opening message
  }, [])

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [msgs.length, busy, failed])

  const send = (value: string) => {
    const v = value.trim()
    if (!v || busy) return
    const thread: Msg[] = [...msgs.map(({ role, text }) => ({ role, text })), { role: 'user', text: v }]
    setMsgs(thread)
    setText('')
    setBusy(true)
    void ask(thread)
  }

  const target = num(form.targetAmount)
  const lastChips = !busy ? msgs[msgs.length - 1]?.chips : undefined

  return (
    <>
      <div className="native-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3 pt-1 md:px-6 [&>*]:shrink-0">
        <GoalDraftCard
          category={form.category}
          name={form.name || '…'}
          target={target}
          saved={num(form.alreadySaved)}
          currency={form.currency}
          targetDate={form.targetDate}
          pace={target > 0 ? form.pace : null}
          quarterly={form.frequency === 'quarterly'}
        />
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <p key={i} className="max-w-[85%] self-end rounded-2xl rounded-ee-[4px] bg-[var(--color-brand-primary-soft)] px-3.5 py-2.5 text-sm text-[var(--color-brand-text-primary)]">
              {m.text}
            </p>
          ) : (
            <div key={i} className="flex max-w-[92%] items-start gap-2 self-start">
              <BuddgyIcon size={24} className="mt-1 shrink-0" />
              <p className="rounded-2xl rounded-ss-[4px] bg-[var(--color-brand-elevated)] px-3.5 py-2.5 text-sm text-[var(--color-brand-text-primary)]">{m.text}</p>
            </div>
          ),
        )}
        {busy ? (
          <div className="self-start rounded-2xl rounded-ss-[4px] bg-[var(--color-brand-elevated)] px-3.5 py-2.5">
            <BuddgyStatus steps={t.status.chat} />
          </div>
        ) : null}
        {failed ? (
          <div className="flex flex-col items-start gap-2 rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-2.5">
            <p className="text-sm text-[var(--color-brand-text-secondary)]">{t.chat.failed}</p>
            <div className="flex gap-2">
              <OptionChip size="sm" onClick={() => { setFailed(false); setBusy(true); void ask(history.current) }}>
                {t.chat.retry}
              </OptionChip>
              <OptionChip size="sm" onClick={onManual}>
                {t.chat.skip}
              </OptionChip>
            </div>
          </div>
        ) : null}
        {lastChips?.length ? (
          <div className="flex flex-wrap gap-2">
            {lastChips.map((c, i) => (
              <OptionChip key={`${i}-${c}`} size="sm" onClick={() => send(c)}>
                {c}
              </OptionChip>
            ))}
          </div>
        ) : null}
        <div ref={end} />
      </div>
      <div className="sheet-cta flex shrink-0 flex-col gap-2.5 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 pb-6 pt-3 md:px-6">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send(text)
          }}
        >
          <Input
            size="brand"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.chat.placeholder}
            aria-label={t.chat.placeholder}
            className="h-11 flex-1 rounded-full bg-[var(--color-brand-elevated)] px-4"
          />
          <IconButton type="submit" variant="solid" shape="round" aria-label={t.chat.send} disabled={busy || !text.trim()}>
            <Send />
          </IconButton>
        </form>
        <Button size="cta-block" disabled={!(target > 0) || busy} onClick={onContinue} className={cn(!(target > 0) && 'hidden')}>
          {t.chat.cont}
        </Button>
      </div>
    </>
  )
}
