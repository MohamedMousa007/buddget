import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The contract of migration 0343. Behaviour on live is covered by e2e I2 (anon calls) and the migration's own asserts.
const sql = readFileSync('supabase/migrations/0343_invite_held_reason_inviter_name.sql', 'utf8')
const fn = sql.slice(sql.indexOf('function public.referral_inviter_first_name'), sql.indexOf('do $$'))

describe('referral_inviter_first_name (the /i/<code> landing page)', () => {
  it('is a security definer function with an empty search path, returning text', () => {
    expect(fn).toMatch(/returns text language plpgsql stable security definer set search_path to ''/)
  })
  it('is executable by anon and authenticated only', () => {
    expect(fn).toMatch(/revoke all on function public\.referral_inviter_first_name\(text\) from public, anon, authenticated, service_role;/)
    const grants = [...sql.matchAll(/grant execute on function public\.referral_inviter_first_name\(text\) to ([^;]+);/g)].map((m) => m[1])
    expect(grants).toEqual(['anon, authenticated'])
  })
  it('returns only the first word of the display name, capped, and nothing for a code that cannot be one', () => {
    const selects = [...fn.matchAll(/select ([\s\S]+?)\n\s+from /g)].map((m) => m[1]!.trim())
    expect(selects).toEqual([`nullif(left(split_part(regexp_replace(btrim(coalesce(nullif(p.display_name, ''), p.name, '')), '\\s+', ' ', 'g'), ' ', 1), 40), '')`])
    expect(fn).toContain("v_code !~ '^[A-Z0-9]{2,8}-[A-Z0-9]{3,5}$' or not public.referrals_enabled() then return null")
    expect(fn).toContain('where c.code = v_code')
    expect(fn).not.toMatch(/email|user_id\s*,|auth\.users/)
  })
})

describe('referral_my_summary held reason', () => {
  it('names only the two held reasons, and only for activated friends', () => {
    expect(sql).toContain("case when r.status = 'activated' and r.reason in ('awaiting_native', 'review') then r.reason end as held")
  })
})
