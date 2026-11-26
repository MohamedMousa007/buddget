import { resolvePaymentBrandKey } from './paymentMethodDefaults'

/**
 * Catalogue brand id -> official logo file in `public/logos/banks/`. Sources and licence notes:
 * `docs/quality/buddget-remediation/bank-logos.md`. A test keeps this map and the folder in step.
 * ADIB Egypt shares ADIB's file (`adib.png`): same brand, same mark. `etisalatcash` and `wepay` carry their parent's mark (e&, WE).
 */
export const BANK_LOGO_FILES: Record<string, string> = {
  aaib: 'aaib.svg',
  aalex: 'aalex.svg',
  adcb: 'adcb.svg',
  adib: 'adib.png',
  adibeg: 'adib.png',
  ajman: 'ajman.png',
  albarakaeg: 'albarakaeg.svg',
  albilad: 'albilad.svg',
  alhilal: 'alhilal.png',
  alinma: 'alinma.svg',
  aljazira: 'aljazira.png',
  alrajhi: 'alrajhi.svg',
  anb: 'anb.svg',
  bankdhofar: 'bankdhofar.png',
  bankmuscat: 'bankmuscat.svg',
  banqueducaire: 'banqueducaire.png',
  banquemisr: 'banquemisr.svg',
  bbk: 'bbk.png',
  bisb: 'bisb.png',
  boubyan: 'boubyan.svg',
  burgan: 'burgan.svg',
  cbd: 'cbd.png',
  cbq: 'cbq.png',
  cib: 'cib.svg',
  d360: 'd360.svg',
  dib: 'dib.png',
  dohabank: 'dohabank.png',
  emiratesinvestment: 'emiratesinvestment.png',
  emiratesislamic: 'emiratesislamic.svg',
  enbd: 'enbd.svg',
  fab: 'fab.svg',
  faisaleg: 'faisaleg.svg',
  gulfbank: 'gulfbank.png',
  hsbceg: 'hsbceg.svg',
  ilabank: 'ilabank.png',
  kfh: 'kfh.svg',
  liv: 'liv.png',
  mashreq: 'mashreq.png',
  nbb: 'nbb.svg',
  nbe: 'nbe.svg',
  nbf: 'nbf.png',
  nbk: 'nbk.svg',
  nbo: 'nbo.png',
  qib: 'qib.svg',
  qnb: 'qnb.svg',
  qnbeg: 'qnbeg.svg',
  rakbank: 'rakbank.svg',
  rakbankislamic: 'rakbankislamic.svg',
  riyadbank: 'riyadbank.svg',
  sabb: 'sabb.svg',
  sib: 'sib.png',
  snb: 'snb.svg',
  weyay: 'weyay.svg',
  wio: 'wio.png',
  // Wallets, card schemes and prepaid brands (catalogue completion).
  adnoc: 'adnoc.svg',
  deel: 'deel.png',
  edenred: 'edenred.svg',
  emarat: 'emarat.svg',
  enoc: 'enoc.svg',
  etisalatcash: 'etisalatcash.svg',
  khazna: 'khazna.png',
  opay: 'opay.svg',
  payit: 'payit.png',
  pluxee: 'pluxee.svg',
  skrill: 'skrill.svg',
  thawani: 'thawani.png',
  unionpay: 'unionpay.svg',
  wepay: 'wepay.svg',
  ziina: 'ziina.png',
}

/**
 * Provider (BNPL / installment / wallet) slug -> official logo file in `public/providers/`. Keys are catalogue ids where
 * the provider is a catalogue brand, and installment slugs (`installmentProviders.ts`) otherwise (mispay, shahry, forsa).
 * The one source for provider logos: `BrandMark` (through {@link bankLogoSrc}) and `ProviderBadge` both read it.
 */
export const PROVIDER_LOGO_FILES: Record<string, string> = {
  aman: 'aman.png',
  cashew: 'cashew.webp',
  contact: 'contact.webp',
  forsa: 'forsa.webp',
  halan: 'halan.svg',
  mispay: 'mispay.png',
  postpay: 'postpay.png',
  shahry: 'shahry.webp',
  souhoola: 'souhoola.webp',
  spotii: 'spotii.svg',
  sympl: 'sympl.webp',
  tabby: 'tabby.svg',
  tamara: 'tamara.png',
  valu: 'valu.png',
}

/**
 * Tile colour for a logo drawn light-on-dark (brand id -> the brand's own background).
 * Absent = the default white tile.
 */
export const BANK_LOGO_BG: Record<string, string> = {
  weyay: '#11042A',
}

/** The logo path for a catalogue id or provider slug (bank file first, then provider file), or null: callers keep the monogram. */
export function bankLogoSrc(brandId: string | null | undefined): string | null {
  if (!brandId) return null
  const bank = BANK_LOGO_FILES[brandId]
  if (bank) return `/logos/banks/${bank}`
  const provider = PROVIDER_LOGO_FILES[brandId]
  return provider ? `/providers/${provider}` : null
}

const bgBySrc = new Map(Object.entries(BANK_LOGO_BG).map(([id, bg]) => [bankLogoSrc(id), bg]))

/** The tile colour for a logo path from {@link bankLogoSrc}, or null for the default white tile. */
export function bankLogoBg(src: string | null | undefined): string | null {
  return (src && bgBySrc.get(src)) || null
}

const byName = new Map<string, string | null>()

/** The logo for an account or provider name ("CIB", "Emirates NBD ••1234"), through the catalogue resolver. */
export function bankLogoForName(name: string | null | undefined): string | null {
  if (!name) return null
  let hit = byName.get(name)
  if (hit === undefined) {
    hit = bankLogoSrc(resolvePaymentBrandKey(name))
    byName.set(name, hit)
  }
  return hit
}
