import { resolvePaymentBrandKey } from './paymentMethodDefaults'

/**
 * Catalogue brand id -> official logo file in `public/logos/banks/`. Sources and licence notes:
 * `docs/quality/buddget-remediation/bank-logos.md`. A test keeps this map and the folder in step.
 */
export const BANK_LOGO_FILES: Record<string, string> = {
  aaib: 'aaib.svg',
  aalex: 'aalex.svg',
  adcb: 'adcb.svg',
  albarakaeg: 'albarakaeg.svg',
  albilad: 'albilad.svg',
  alinma: 'alinma.svg',
  alrajhi: 'alrajhi.svg',
  anb: 'anb.svg',
  bankdhofar: 'bankdhofar.png',
  banquemisr: 'banquemisr.svg',
  bbk: 'bbk.png',
  boubyan: 'boubyan.svg',
  burgan: 'burgan.svg',
  cbq: 'cbq.png',
  cib: 'cib.svg',
  d360: 'd360.svg',
  enbd: 'enbd.png',
  fab: 'fab.svg',
  hsbceg: 'hsbceg.svg',
  ilabank: 'ilabank.png',
  kfh: 'kfh.svg',
  nbb: 'nbb.svg',
  nbe: 'nbe.svg',
  nbk: 'nbk.svg',
  qib: 'qib.svg',
  qnb: 'qnb.svg',
  qnbeg: 'qnbeg.svg',
  riyadbank: 'riyadbank.svg',
  sabb: 'sabb.svg',
  snb: 'snb.svg',
}

/** The logo path for a catalogue id, or null when the bank has no file (callers keep the monogram). */
export function bankLogoSrc(brandId: string | null | undefined): string | null {
  const file = brandId ? BANK_LOGO_FILES[brandId] : undefined
  return file ? `/logos/banks/${file}` : null
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
