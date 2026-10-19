'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { renderTemplate } from '@/lib/email/render'
import { EMAIL_VARIABLES } from '@/lib/email/variables'
import type { EmailScenario } from '@/lib/email/scenarios'
import { Field } from '../ui/Field'

type Device = 'desktop' | 'phone'
type Theme = 'light' | 'dark'

/** The dark rules sit behind `prefers-color-scheme`, which the iframe takes from the OS; forcing the query lets the toggle decide. */
export function forceScheme(html: string, theme: Theme): string {
  return html.replace(/@media \(prefers-color-scheme: dark\)/g, theme === 'dark' ? '@media all' : '@media not all')
}

/**
 * Live preview in a sandboxed iframe: no scripts, no navigation, no same-origin access. Sample values are escaped
 * exactly as they are when sending.
 */
export function EmailPreview({ scenario, subject, preheader, html, sample, onSample }: {
  scenario: EmailScenario
  subject: string
  preheader: string
  html: string
  sample: Record<string, string>
  onSample: (name: string, value: string) => void
}) {
  const [device, setDevice] = useState<Device>('desktop')
  const [theme, setTheme] = useState<Theme>('light')
  const [editing, setEditing] = useState(false)
  const doc = useMemo(() => {
    const out = renderTemplate({ subject, preheader, html }, sample)
    return { subject: out.subject, srcDoc: forceScheme(out.html, theme) }
  }, [subject, preheader, html, sample, theme])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SegmentedControl ariaLabel="Preview width" fill={false} value={device} onChange={setDevice} options={[{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }]} />
        <SegmentedControl ariaLabel="Preview theme" fill={false} value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </div>
      <p className="truncate text-xs text-[var(--color-brand-text-muted)]">Subject: <span className="text-[var(--color-brand-text-primary)]">{doc.subject}</span></p>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-sunken)] p-2">
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={doc.srcDoc}
          style={{ width: device === 'phone' ? 375 : 640, maxWidth: '100%' }}
          className="mx-auto block h-[560px] rounded-lg border-0 bg-white"
        />
      </div>
      <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Hide sample data' : 'Edit sample data'}</Button>
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {scenario.vars.map((v) => (
            <Field key={v} label={EMAIL_VARIABLES[v].label}>
              <Input size="brand" value={sample[v] ?? ''} onChange={(e) => onSample(v, e.target.value)} />
            </Field>
          ))}
        </div>
      ) : null}
    </div>
  )
}
