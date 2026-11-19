import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/app/(app)/legal/privacy/sections'
const read = (f: string) => readFileSync(`${dir}/${f}`, 'utf8')
const files = ['PrivacyDataSections.tsx', 'PrivacyLegalSections.tsx', 'PrivacyTechSections.tsx']

describe('SLG-6 / SLG-7 / SLG-12: the privacy policy matches the deployment and the code', () => {
  it('names the real storage region (Supabase eu-central-1, Vercel fra1), EN and AR', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { regions: string[] }
    expect(vercel.regions).toEqual(['fra1'])
    expect(read('PrivacyDataSections.tsx')).toContain('servers in Frankfurt, Germany')
    expect(read('ar/PrivacyDataSections.tsx')).toContain('في فرانكفورت بألمانيا')
    for (const f of [...files, ...files.map((x) => `ar/${x}`)]) {
      expect(read(f), f).not.toMatch(/servers in the United States|في الولايات المتحدة\.|الولايات المتحدة التي تستضيف/)
    }
  })

  it('states the retention the SQL implements (60 day cap for unconfirmed messages, recurring patterns kept)', () => {
    expect(read('PrivacyDataSections.tsx')).toMatch(/up to\s+60 days for a message still waiting/)
    expect(read('PrivacyDataSections.tsx')).toMatch(/recur across many messages/)
    expect(read('ar/PrivacyDataSections.tsx')).toContain('وحتى 60 يومًا للرسالة التي لا تزال بانتظار تأكيدك')
  })

  it('does not claim notification ingestion, which does not exist', () => {
    for (const f of ['PrivacyDataSections.tsx', 'PrivacyTechSections.tsx']) expect(read(f)).not.toMatch(/SMS or notifications|SMS and notification ingest/)
    expect(read('ar/PrivacyDataSections.tsx')).not.toContain('الرسائل النصية أو الإشعارات')
    expect(read('ar/PrivacyTechSections.tsx')).not.toContain('الرسائل النصية والإشعارات')
  })

  it('QA-71: says which SMS leave the phone (business senders with a number, or transaction-like), not only bank SMS, EN and AR', () => {
    const en = read('PrivacyDataSections.tsx')
    const ar = read('ar/PrivacyDataSections.tsx')
    expect(en).toMatch(/messages from business\s+senders/)
    expect(en).toMatch(/look like a\s+transaction/)
    expect(en).not.toMatch(/bank notification SMS|forward bank SMS/)
    expect(ar).toContain('رسائل الجهات التجارية')
    expect(ar).not.toMatch(/رسائل إشعارات البنك|رسائل البنك النصية/)
  })
})
