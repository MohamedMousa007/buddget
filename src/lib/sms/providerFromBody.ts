import { PAYMENT_BRANDS } from '@/lib/payment/paymentMethodDefaults'

/**
 * Which bank or wallet a message came from, read from the message itself.
 *
 * iOS never tells an app who sent a message: the Shortcuts Message trigger hands over the text and nothing else
 * (production data: 0 of 824 forwarded messages ever carried a sender), so the sender has to be recovered from the body,
 * which banks sign: a hotline number, "From HSBC:", a wallet name. Deterministic and free, so it runs before any AI.
 */

/** Customer-service lines banks print in their messages -> catalogue brand id. */
const HOTLINES: Record<string, string> = {
  '19666': 'cib',
  '19623': 'nbe',
  '19888': 'nbe',
  '19700': 'qnbeg',
  '16664': 'banquemisr',
}

/** Bank acronyms are short on purpose; any other short alias ("bm", "mc", "ila", "nol") is too likely to be a word. */
const SHORT_OK = new Set(['cib', 'nbe', 'hsbc', 'fab', 'adcb', 'dib', 'enbd', 'aaib', 'qnb', 'nbk', 'kfh', 'nbb', 'bbk', 'nbo', 'snb', 'sabb', 'anb', 'adib', 'cbd', 'cbq', 'qib'])
/** A brand you can also buy from (telecoms, Fawry) is only named by its payment wording, never by the bare company name. */
const PAYMENT_WORDING = /(cash|pay|money|wallet|كاش|محفظة|فلوس)/i

interface Needle { brandId: string; re: RegExp }

function needlesFor(): Needle[] {
  const out: Needle[] = []
  for (const brand of Object.values(PAYMENT_BRANDS)) {
    if ((brand.type !== 'bank_account' && brand.type !== 'wallet') || brand.passThrough) continue
    const names = [brand.name, brand.full, ...(brand.aliases ?? [])].filter((n): n is string => Boolean(n))
    for (const raw of names) {
      const n = raw.trim().toLowerCase()
      const latin = /^[a-z0-9 &.-]+$/.test(n)
      if (latin && n.length < 4 && !SHORT_OK.has(n)) continue
      if (brand.alsoMerchant && !PAYMENT_WORDING.test(n)) continue
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      out.push({ brandId: brand.id, re: latin ? new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, 'i') : new RegExp(esc, 'i') })
    }
  }
  return out
}

let cache: Needle[] | null = null

export interface DetectedProvider {
  brandId: string
  name: string
  /** How the message named it: its own hotline (a signature), or a bank name at character `at`. */
  via: 'hotline' | 'name'
  at: number
}

/**
 * The provider whose hotline the message prints, else the earliest provider it names, else null. The hotline wins
 * because it is the sending bank's own signature, while a name can belong to someone else in the story: the bank that
 * owns the cash machine, or the bank the money was sent to.
 */
export function providerFromBody(message: string): DetectedProvider | null {
  for (const m of message.matchAll(/\b(\d{5})\b/g)) {
    const id = HOTLINES[m[1]]
    if (id) return { brandId: id, name: PAYMENT_BRANDS[id].name, via: 'hotline', at: m.index ?? 0 }
  }
  cache ??= needlesFor()
  let best: { brandId: string; at: number } | null = null
  for (const { brandId, re } of cache) {
    const m = re.exec(message)
    if (m && (!best || m.index < best.at)) best = { brandId, at: m.index }
  }
  return best ? { brandId: best.brandId, name: PAYMENT_BRANDS[best.brandId].name, via: 'name', at: best.at } : null
}
