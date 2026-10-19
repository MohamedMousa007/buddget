import { escapeHtml } from './variables'
import type { EmailLocale } from './scenarios'

/** The visual editor's building blocks. Rendered to table-based, inline-styled, dark-mode-aware email HTML. */
export type EmailBlock =
  | { id: string; type: 'logo' }
  | { id: string; type: 'heading'; eyebrow: string; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'code'; label: string; value: string }
  | { id: string; type: 'note'; title: string; text: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'image'; src: string; alt: string }
  | { id: string; type: 'footer'; text: string }

export type BlockType = EmailBlock['type']

export const BLOCK_LABEL: Record<BlockType, string> = {
  logo: 'Logo', heading: 'Heading', paragraph: 'Paragraph', button: 'Button', code: 'Code box', note: 'Note', divider: 'Divider', image: 'Image', footer: 'Footer',
}

let seq = 0
export const blockId = (): string => `b${Date.now().toString(36)}${(seq++).toString(36)}`

export function newBlock(type: BlockType): EmailBlock {
  const id = blockId()
  switch (type) {
    case 'logo': return { id, type }
    case 'heading': return { id, type, eyebrow: '', text: 'Heading' }
    case 'paragraph': return { id, type, text: 'Write something here.' }
    case 'button': return { id, type, label: 'Open Buddget', url: '{{link}}' }
    case 'code': return { id, type, label: 'Verification code', value: '{{code}}' }
    case 'note': return { id, type, title: 'Didn’t ask for this?', text: 'You can ignore this email.' }
    case 'divider': return { id, type }
    case 'image': return { id, type, src: 'https://buddget.app/email/buddget-wordmark-ink.png', alt: '' }
    case 'footer': return { id, type, text: 'Sent by Buddget\nThis is an automated message, please don’t reply.' }
  }
}

const C = {
  bg: '#F4F7F6', card: '#FFFFFF', border: '#DDE6E4', well: '#ECF1F0', text: '#0D1A18', text2: '#566B68', text3: '#687371',
  accent: '#12B0A0', action: '#0D8578', ink: '#0B7568', note: '#E3F6F3',
}

const SANS = "'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
const SANS_AR = "'Segoe UI',Tahoma,'Noto Sans Arabic',Arial,sans-serif"

const text = (s: string) => escapeHtml(s).replace(/\r?\n/g, '<br />')

/** Links and image sources: a variable, or http(s)/mailto. Anything else becomes a dead anchor. */
function safeUrl(url: string): string {
  const u = url.trim()
  return /^\{\{\s*[a-z_]+\s*\}\}$/.test(u) || /^(https?:|mailto:)/i.test(u) ? escapeHtml(u) : '#'
}

const row = (inner: string, pad: string, align = 'center') => `
          <tr><td align="${align}" style="padding:${pad};">${inner}</td></tr>`

function renderBlock(b: EmailBlock, rtl: boolean): string {
  const start = rtl ? 'right' : 'left'
  switch (b.type) {
    case 'logo':
      return row(`
              <img class="logo-light" src="https://buddget.app/email/buddget-wordmark-ink.png" width="168" height="40" alt="Buddget" style="display:inline-block; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />
              <img class="logo-dark" src="https://buddget.app/email/buddget-wordmark-light.png" width="168" height="40" alt="" style="display:none; border:0; outline:none; text-decoration:none; height:40px; width:168px;" />`, '36px 40px 8px')
    case 'heading':
      return row(`${b.eyebrow ? `
              <p class="text-3" style="margin:0 0 10px; font-size:11px; font-weight:600; letter-spacing:${rtl ? 0 : 1.4}px; text-transform:uppercase; color:${C.text3};">${text(b.eyebrow)}</p>` : ''}
              <h1 class="text" style="margin:0; font-size:24px; line-height:1.3; font-weight:700; color:${C.text};">${text(b.text)}</h1>`, '20px 40px 0')
    case 'paragraph':
      return row(`<p class="text-2" style="margin:0; font-size:15px; line-height:1.6; color:${C.text2};">${text(b.text)}</p>`, '10px 40px 0')
    case 'button':
      return row(`<a href="${safeUrl(b.url)}" style="display:block; background-color:${C.action}; color:#FFFFFF; font-size:16px; font-weight:700; line-height:52px; height:52px; text-align:center; text-decoration:none; border-radius:14px;">${text(b.label)}</a>`, '28px 40px 8px')
    case 'code':
      return row(`
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td class="well" align="center" style="background-color:${C.well}; border:1px solid ${C.border}; border-radius:16px; padding:22px 16px;">${b.label ? `
                    <p class="text-3" style="margin:0 0 8px; font-size:11px; font-weight:600; letter-spacing:${rtl ? 0 : 1.4}px; text-transform:uppercase; color:${C.text3};">${text(b.label)}</p>` : ''}
                    <p class="ink" dir="ltr" style="margin:0; font-size:40px; line-height:1.1; font-weight:700; letter-spacing:10px; color:${C.ink}; font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace; padding-left:10px;">${text(b.value)}</p>
                  </td>
                </tr>
              </table>`, '28px 40px 8px')
    case 'note':
      return row(`
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="note" style="background-color:${C.note}; border-${start}:3px solid ${C.action}; border-radius:${rtl ? '12px 0 0 12px' : '0 12px 12px 0'}; padding:14px 16px; text-align:${start};">
                    <p class="text-2" style="margin:0; font-size:13px; line-height:1.55; color:${C.text2};">${b.title ? `<strong class="text" style="color:${C.text};">${text(b.title)}</strong> ` : ''}${text(b.text)}</p>
                  </td>
                </tr>
              </table>`, '24px 40px 8px', start)
    case 'divider':
      return row(`<div class="rule" style="height:1px; line-height:1px; background-color:${C.border};">&nbsp;</div>`, '24px 40px 0')
    case 'image':
      return row(`<img src="${safeUrl(b.src)}" alt="${escapeHtml(b.alt)}" width="400" style="display:block; max-width:100%; height:auto; border:0; border-radius:12px;" />`, '20px 40px 0')
    case 'footer':
      return row(b.text.split(/\r?\n/).map((line, i) => `<p class="text-3" style="margin:${i === 0 ? '0 0 4px' : '0'}; font-size:12px; line-height:1.5; color:${C.text3};">${escapeHtml(line)}</p>`).join('\n              '), '20px 40px 32px')
  }
}

export interface BlockRenderOptions {
  locale: EmailLocale
  subject: string
  preheader: string
}

const DARK_CSS = `    .logo-dark { display: none !important; }
    @media (prefers-color-scheme: dark) {
      .bg { background-color: #0A100F !important; }
      .card { background-color: #111917 !important; border-color: #25302E !important; }
      .well { background-color: #18211F !important; border-color: #25302E !important; }
      .rule { background-color: #25302E !important; }
      .text { color: #EAF2F0 !important; }
      .text-2 { color: #9BABA8 !important; }
      .text-3 { color: #748380 !important; }
      .ink { color: #7FE6DA !important; }
      .note { background-color: #0F2723 !important; border-color: #1FC3B2 !important; }
      .logo-light { display: none !important; }
      .logo-dark { display: inline-block !important; }
    }`

export function renderBlocks(blocks: readonly EmailBlock[], o: BlockRenderOptions): string {
  const rtl = o.locale === 'ar'
  return `<!DOCTYPE html>
<html lang="${o.locale}" dir="${rtl ? 'rtl' : 'ltr'}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(o.subject)}</title>
  <style>
${DARK_CSS}
  </style>
</head>
<body class="bg" style="margin:0; padding:0; background-color:${C.bg}; font-family:${rtl ? SANS_AR : SANS}; -webkit-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:${C.bg}; font-size:1px; line-height:1px;">${escapeHtml(o.preheader)}</div>
  <table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg}; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:${C.card}; border:1px solid ${C.border}; border-radius:20px; overflow:hidden;">
          <tr><td style="height:4px; line-height:4px; font-size:0; background-color:${C.accent};">&nbsp;</td></tr>${blocks.map((b) => renderBlock(b, rtl)).join('')}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

const FIELDS: Record<BlockType, readonly string[]> = {
  logo: [], heading: ['eyebrow', 'text'], paragraph: ['text'], button: ['label', 'url'], code: ['label', 'value'], note: ['title', 'text'], divider: [], image: ['src', 'alt'], footer: ['text'],
}

export const MAX_BLOCKS = 60

/** Untrusted JSON to blocks. Unknown shapes are rejected rather than repaired, so stored blocks always render. */
export function parseBlocks(input: unknown): EmailBlock[] | null {
  if (!Array.isArray(input) || input.length > MAX_BLOCKS) return null
  const out: EmailBlock[] = []
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) return null
    const r = raw as Record<string, unknown>
    const type = r.type as BlockType
    if (!Object.hasOwn(FIELDS, type)) return null
    const block: Record<string, unknown> = { id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : blockId(), type }
    for (const f of FIELDS[type]) {
      if (typeof r[f] !== 'string' || (r[f] as string).length > 2000) return null
      block[f] = r[f]
    }
    out.push(block as EmailBlock)
  }
  return out
}
