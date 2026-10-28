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

const SECRET_TOKEN_RE = /\{\{\s*(?:link|code)\s*\}\}/i
const OWN_LINK_RE = /^\s*\{\{\s*link\s*\}\}\s*$/i
const TAG_WITH_ATTRS_RE = /<\s*([a-z][a-z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi

const SECRET_PLACEMENT_ERROR = 'The {{link}} and {{code}} placeholders can only be used as the visible text, or {{link}} as the whole address of a button or link. They can never sit inside an image, another address or any other attribute.'

/** The one-time link/code may only appear as text, or as the entire href of an anchor: anywhere else it would leave the email in a request. */
function misplacedSecret(html: string): boolean {
  for (const [, tag, attrs] of html.matchAll(TAG_WITH_ATTRS_RE)) {
    for (const [, name, dq, sq, bare] of (attrs ?? '').matchAll(ATTR_RE)) {
      const value = dq ?? sq ?? bare ?? ''
      if (SECRET_TOKEN_RE.test(name!)) return true
      if (!SECRET_TOKEN_RE.test(value)) continue
      if (!(tag!.toLowerCase() === 'a' && name!.toLowerCase() === 'href' && OWN_LINK_RE.test(value))) return true
    }
  }
  for (const [, css] of html.matchAll(STYLE_BLOCK_RE)) if (SECRET_TOKEN_RE.test(css ?? '')) return true
  return false
}

/** The reason the HTML cannot be sent, or null when it only uses allow-listed tags and safe attributes. */
export function unsafeEmailHtml(html: string): string | null {
  if (/<script[\s>]/i.test(html)) return 'Scripts are not allowed in email.'
  for (const [tag, name] of html.matchAll(TAG_RE)) {
    if (!ALLOWED_TAGS.has(name.toLowerCase())) return `The <${name.toLowerCase()}> tag is not allowed in email.`
    if (EVENT_HANDLER_RE.test(tag)) return 'Event handler attributes (onclick, onload, ...) are not allowed in email.'
    if (SCRIPT_URL_RE.test(tag)) return 'javascript:, vbscript: and data: links are not allowed in email.'
    if (name.toLowerCase() === 'meta' && REFRESH_RE.test(tag)) return 'Meta refresh is not allowed in email.'
  }
  if (misplacedSecret(html)) return SECRET_PLACEMENT_ERROR
  return null
}

/** Every distinct host an email links to or loads from, for the publish audit row. */
export function externalHosts(html: string): string[] {
  return [...new Set([...html.matchAll(/https?:\/\/([^/"'\s<>?#]+)/gi)].map((m) => m[1]!.toLowerCase()))].sort()
}
