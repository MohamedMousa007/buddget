import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dir = 'src/app/(app)/legal/privacy/sections'
const read = (f: string) => readFileSync(`${dir}/${f}`, 'utf8')
const files = ['PrivacyDataSections.tsx', 'PrivacyLegalSections.tsx', 'PrivacyTechSections.tsx']

describe('SLG-6 / SLG-7 / SLG-12: the privacy policy matches the deployment and the code', () => {
  it('names the real storage region (Supabase ap-southeast-1, Vercel sin1), EN and AR', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as { regions: string[] }
    expect(vercel.regions).toEqual(['sin1'])
    expect(read('PrivacyDataSections.tsx')).toContain('servers in Singapore')
    expect(read('ar/PrivacyDataSections.tsx')).toContain('في سنغافورة')
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
})
