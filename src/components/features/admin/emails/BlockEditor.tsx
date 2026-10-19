'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { Textarea } from '@/components/ui/textarea'
import { BLOCK_LABEL, newBlock, type BlockType, type EmailBlock } from '@/lib/email/blocks'
import { Field } from '../ui/Field'

const FIELDS: Record<BlockType, ReadonlyArray<{ name: string; label: string; multiline?: boolean }>> = {
  logo: [],
  heading: [{ name: 'eyebrow', label: 'Small label above (optional)' }, { name: 'text', label: 'Heading' }],
  paragraph: [{ name: 'text', label: 'Text', multiline: true }],
  button: [{ name: 'label', label: 'Label' }, { name: 'url', label: 'Link' }],
  code: [{ name: 'label', label: 'Label' }, { name: 'value', label: 'Value' }],
  note: [{ name: 'title', label: 'Bold lead-in (optional)' }, { name: 'text', label: 'Text', multiline: true }],
  divider: [],
  image: [{ name: 'src', label: 'Image URL (https)' }, { name: 'alt', label: 'Description' }],
  footer: [{ name: 'text', label: 'Lines (one per row)', multiline: true }],
}

const ADDABLE = (Object.keys(FIELDS) as BlockType[])

export function BlockEditor({ blocks, onChange, dir }: { blocks: EmailBlock[]; onChange: (next: EmailBlock[]) => void; dir: 'ltr' | 'rtl' }) {
  const set = (i: number, patch: Record<string, string>) => onChange(blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as EmailBlock) : b)))
  const move = (i: number, by: -1 | 1) => {
    const next = [...blocks]
    const [item] = next.splice(i, 1)
    next.splice(i + by, 0, item!)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={b.id} className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{BLOCK_LABEL[b.type]}</p>
            <div className="flex">
              <IconButton aria-label={`Move ${BLOCK_LABEL[b.type]} up`} size="sm" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></IconButton>
              <IconButton aria-label={`Move ${BLOCK_LABEL[b.type]} down`} size="sm" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}><ArrowDown /></IconButton>
              <IconButton aria-label={`Remove ${BLOCK_LABEL[b.type]}`} size="sm" variant="danger" onClick={() => onChange(blocks.filter((_, j) => j !== i))}><Trash2 /></IconButton>
            </div>
          </div>
          {FIELDS[b.type].length ? (
            <div className="mt-2 space-y-3">
              {FIELDS[b.type].map((f) => {
                const value = (b as unknown as Record<string, string>)[f.name] ?? ''
                return (
                  <Field key={f.name} label={f.label}>
                    {f.multiline
                      ? <Textarea dir={dir} rows={3} value={value} onChange={(e) => set(i, { [f.name]: e.target.value })} className="bg-[var(--color-brand-card)]" />
                      : <Input size="brand" dir={dir} value={value} onChange={(e) => set(i, { [f.name]: e.target.value })} />}
                  </Field>
                )
              })}
            </div>
          ) : null}
        </div>
      ))}
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Add a block</p>
        <div className="flex flex-wrap gap-2">
          {ADDABLE.map((t) => (
            <OptionChip key={t} size="sm" onClick={() => onChange([...blocks, newBlock(t)])}><Plus />{BLOCK_LABEL[t]}</OptionChip>
          ))}
        </div>
      </div>
    </div>
  )
}
