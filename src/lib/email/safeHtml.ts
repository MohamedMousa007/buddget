/** Tags an email body may use. Anything else (script, iframe, object, form, svg, link, base, ...) is refused. */
const ALLOWED_TAGS = new Set([
  'html', 'head', 'body', 'title', 'meta', 'style', 'center', 'div', 'span', 'p', 'br', 'hr', 'a', 'img', 'font',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col', 'caption',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup',
  'blockquote', 'pre', 'code', 'abbr', 'wbr',
])

const TAG_RE = /<\/?\s*([a-z][a-z0-9-]*)\b[^>]*>/gi
const EVENT_HANDLER_RE = /[\s"'/]on[a-z]+\s*=/i
const SCRIPT_URL_RE = /(?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript|data)\s*:/i
const REFRESH_RE = /http-equiv\s*=\s*["']?refresh/i

/** The reason the HTML cannot be sent, or null when it only uses allow-listed tags and safe attributes. */
export function unsafeEmailHtml(html: string): string | null {
  if (/<script[\s>]/i.test(html)) return 'Scripts are not allowed in email.'
  for (const [tag, name] of html.matchAll(TAG_RE)) {
    if (!ALLOWED_TAGS.has(name.toLowerCase())) return `The <${name.toLowerCase()}> tag is not allowed in email.`
    if (EVENT_HANDLER_RE.test(tag)) return 'Event handler attributes (onclick, onload, ...) are not allowed in email.'
    if (SCRIPT_URL_RE.test(tag)) return 'javascript:, vbscript: and data: links are not allowed in email.'
    if (name.toLowerCase() === 'meta' && REFRESH_RE.test(tag)) return 'Meta refresh is not allowed in email.'
  }
  return null
}
