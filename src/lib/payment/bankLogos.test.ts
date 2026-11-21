import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PAYMENT_BRANDS, resolvePaymentBrandKey } from './paymentMethodDefaults'
import { BANK_LOGO_FILES, bankLogoForName, bankLogoSrc } from './bankLogos'

const DIR = join(__dirname, '../../../public/logos/banks')
const files = readdirSync(DIR).filter((f) => !f.startsWith('.'))
const ids = Object.keys(BANK_LOGO_FILES)
/** Ids that use another brand's file on purpose (same bank, same mark). */
const SHARED: Record<string, string> = { adibeg: 'adib' }

describe('bank logos (BDG-024)', () => {
  it('the map and the folder list the same files, each named after a catalogue id', () => {
    expect([...new Set(Object.values(BANK_LOGO_FILES))].sort()).toEqual([...files].sort())
    for (const id of ids) {
      expect(PAYMENT_BRANDS[id], id).toBeDefined()
      expect(BANK_LOGO_FILES[id]).toMatch(new RegExp(`^${SHARED[id] ?? id}\\.(svg|png)$`))
    }
  })

  it('ADIB Egypt shares the ADIB file', () => {
    expect(BANK_LOGO_FILES.adibeg).toBe('adib.png')
    expect(bankLogoSrc('adibeg')).toBe(bankLogoSrc('adib'))
    expect(bankLogoForName('ADIB Egypt')).toBe('/logos/banks/adib.png')
  })

  it('the owner-supplied banks resolve to their files (step 18b)', () => {
    const expected: Record<string, string> = {
      adcb: 'adcb.svg', adib: 'adib.png', bisb: 'bisb.png', dib: 'dib.png', dohabank: 'dohabank.png',
      emiratesislamic: 'emiratesislamic.svg', enbd: 'enbd.svg', fab: 'fab.svg', faisaleg: 'faisaleg.svg',
      liv: 'liv.png', mashreq: 'mashreq.png', nbo: 'nbo.png', rakbank: 'rakbank.png', sib: 'sib.png', wio: 'wio.png',
      gulfbank: 'gulfbank.png', cbd: 'cbd.png', aljazira: 'aljazira.png', banqueducaire: 'banqueducaire.png', bankmuscat: 'bankmuscat.svg',
      ajman: 'ajman.png', nbf: 'nbf.png', emiratesinvestment: 'emiratesinvestment.png', alhilal: 'alhilal.png',
    }
    for (const [id, file] of Object.entries(expected)) expect(bankLogoSrc(id), id).toBe(`/logos/banks/${file}`)
    expect(bankLogoForName('Sharjah Islamic Bank')).toBe('/logos/banks/sib.png')
    expect(bankLogoForName('Emirates Islamic')).toBe('/logos/banks/emiratesislamic.svg')
    expect(bankLogoForName('National Bank of Fujairah')).toBe('/logos/banks/nbf.png')
    expect(bankLogoForName('Emirates Investment Bank')).toBe('/logos/banks/emiratesinvestment.png')
    expect(bankLogoForName('Al Hilal Bank')).toBe('/logos/banks/alhilal.png')
    expect(bankLogoForName('Ajman Bank')).toBe('/logos/banks/ajman.png')
    expect(bankLogoForName('Emirates NBD ••1234')).toBe('/logos/banks/enbd.svg')
  })

  it('Zand is gone from the catalogue; a method still named Zand keeps the monogram', () => {
    expect(PAYMENT_BRANDS.zand).toBeUndefined()
    expect(resolvePaymentBrandKey('Zand')).toBeNull()
    expect(bankLogoSrc('zand')).toBeNull()
    expect(bankLogoForName('Zand')).toBeNull()
  })

  it('every catalogue id with a file resolves to it, by id and by its catalogue name', () => {
    for (const id of ids) {
      expect(bankLogoSrc(id)).toBe(`/logos/banks/${BANK_LOGO_FILES[id]}`)
      expect(bankLogoForName(PAYMENT_BRANDS[id].name), id).toBe(`/logos/banks/${BANK_LOGO_FILES[id]}`)
    }
  })

  it('a brand without a file, an unknown id and generic names get no logo', () => {
    const without = Object.keys(PAYMENT_BRANDS).find((id) => !BANK_LOGO_FILES[id])!
    expect(bankLogoSrc(without)).toBeNull()
    expect(bankLogoSrc('no-such-bank')).toBeNull()
    expect(bankLogoSrc(null)).toBeNull()
    for (const name of ['Cash', 'Bank', 'Savings', 'My account', '', null]) expect(bankLogoForName(name), String(name)).toBeNull()
  })

  it('SVG files carry no script, event handler, foreignObject or external reference', () => {
    for (const f of files.filter((x) => x.endsWith('.svg'))) {
      const svg = readFileSync(join(DIR, f), 'utf8')
      expect(svg, f).toMatch(/^<svg[\s>]/)
      expect(svg, f).not.toMatch(/<script|<foreignObject|<image|<!DOCTYPE|<!ENTITY|@import/i)
      expect(svg, f).not.toMatch(/\son[a-z]+\s*=/i)
      expect(svg, f).not.toMatch(/href\s*=\s*["'](?!#)/i)
      expect(svg, f).not.toMatch(/url\(\s*["']?(?!#)/i)
    }
  })

  it('PNG files are real PNGs no larger than 512px', () => {
    for (const f of files.filter((x) => x.endsWith('.png'))) {
      const b = readFileSync(join(DIR, f))
      expect(b.subarray(1, 4).toString('latin1'), f).toBe('PNG')
      expect(Math.max(b.readUInt32BE(16), b.readUInt32BE(20)), f).toBeLessThanOrEqual(512)
    }
  })
})
