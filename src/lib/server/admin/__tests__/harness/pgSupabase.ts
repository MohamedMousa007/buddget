/**
 * Test-only stand-in for the supabase-js service client, executing against a real local Postgres.
 *
 * It speaks the subset of the PostgREST builder API the admin routes use, but runs real SQL: constraints, triggers,
 * unique indexes and the `admin_*` functions behave exactly as in production. Connections run as `service_role`
 * so missing grants fail here too. Not a general-purpose client — unsupported calls throw loudly.
 */
import { Pool, types } from 'pg'

types.setTypeParser(1184, (v) => new Date(v).toISOString())
types.setTypeParser(1114, (v) => new Date(v + 'Z').toISOString())
types.setTypeParser(1082, (v) => v)
types.setTypeParser(1700, (v) => Number(v))
types.setTypeParser(20, (v) => Number(v))

const base = process.env.QA_PG_URL ?? ''
export const pgEnabled = base !== ''

let service: Pool | null = null
let admin: Pool | null = null

/** Superuser pool: seeding, assertions, and the GoTrue stand-in. */
export function adminPool(): Pool {
  return (admin ??= new Pool({ connectionString: base, max: 4 }))
}
function servicePool(): Pool {
  return (service ??= new Pool({ connectionString: base, max: 6, options: '-c role=service_role' }))
}
export async function closePools(): Promise<void> {
  await service?.end()
  await admin?.end()
  service = admin = null
}

interface Col { type: string }
const schemaCache = new Map<string, { cols: Map<string, Col>; pk: string[] }>()
async function tableInfo(table: string) {
  const hit = schemaCache.get(table)
  if (hit) return hit
  const cols = await adminPool().query<{ column_name: string; data_type: string; udt_name: string }>(
    `select column_name, data_type, udt_name from information_schema.columns where table_schema='public' and table_name=$1`, [table])
  const pk = await adminPool().query<{ attname: string }>(
    `select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum = any(i.indkey)
     where i.indrelid = ('public.' || quote_ident($1))::regclass and i.indisprimary`, [table])
  const info = { cols: new Map(cols.rows.map((c) => [c.column_name, { type: c.data_type === 'ARRAY' ? 'array' : c.udt_name }])), pk: pk.rows.map((r) => r.attname) }
  schemaCache.set(table, info)
  return info
}

type Cond = { sql: (p: (v: unknown) => string) => string }
const q = (id: string) => '"' + id.replace(/"/g, '""') + '"'

function opCond(col: string, op: string, raw: string): Cond {
  const c = q(col)
  return {
    sql: (p) => {
      switch (op) {
        case 'eq': return `${c} = ${p(raw)}`
        case 'neq': return `${c} <> ${p(raw)}`
        case 'gt': return `${c} > ${p(raw)}`
        case 'gte': return `${c} >= ${p(raw)}`
        case 'lt': return `${c} < ${p(raw)}`
        case 'lte': return `${c} <= ${p(raw)}`
        case 'like': return `${c}::text like ${p(raw)}`
        case 'ilike': return `${c}::text ilike ${p(raw)}`
        case 'is': return raw === 'null' ? `${c} is null` : raw === 'true' ? `${c} is true` : `${c} is false`
        case 'in': return `${c}::text = any(${p(splitList(raw.slice(1, -1)))})`
        case 'cs': return `${c} @> ${p(`{${raw.slice(1, -1)}}`)}`
        default: throw new Error(`unsupported operator ${op}`)
      }
    },
  }
}

function splitTop(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur) out.push(cur)
  return out
}
const splitList = (s: string) => s.split(',').map((x) => x.replace(/^"|"$/g, ''))

/** PostgREST `or=(...)` grammar: comma-separated `col.op.value`, or nested `and(...)` / `or(...)`. */
function wrap(kind: 'and' | 'or', ...conds: Cond[]): Cond {
  return { sql: (p) => '(' + conds.map((c) => c.sql(p)).join(kind === 'and' ? ' and ' : ' or ') + ')' }
}
function parseNested(expr: string, kind: 'and' | 'or'): Cond {
  return wrap(kind, ...splitTop(expr).map((part) => {
    const m = part.match(/^(and|or)\(([\s\S]*)\)$/)
    if (m) return parseNested(m[2]!, m[1] as 'and' | 'or')
    const [col, op, ...rest] = part.split('.')
    if (!col || !op) throw new Error(`malformed filter: ${part}`)
    return opCond(col, op, rest.join('.'))
  }))
}

interface Result<T = unknown> { data: T; error: { message: string; code?: string } | null; count?: number | null }

class Builder implements PromiseLike<Result> {
  private conds: Cond[] = []
  private orders: string[] = []
  private lim: number | null = null
  private off = 0
  private cols = '*'
  private mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private payload: Record<string, unknown> | Record<string, unknown>[] = {}
  private onConflict: string[] | null = null
  private returning = false
  private singleMode: 'one' | 'maybe' | null = null
  private head = false
  private wantCount = false

  constructor(private table: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.mode === 'select') this.cols = cols
    else this.returning = true
    if (opts?.count) this.wantCount = true
    if (opts?.head) this.head = true
    return this
  }
  insert(v: Record<string, unknown> | Record<string, unknown>[]) { this.mode = 'insert'; this.payload = v; return this }
  upsert(v: Record<string, unknown> | Record<string, unknown>[], o?: { onConflict?: string }) {
    this.mode = 'upsert'; this.payload = v; this.onConflict = o?.onConflict?.split(',') ?? null; return this
  }
  update(v: Record<string, unknown>) { this.mode = 'update'; this.payload = v; return this }
  delete() { this.mode = 'delete'; return this }

  private add(fn: (p: (v: unknown) => string) => string) { this.conds.push({ sql: fn }); return this }
  eq(c: string, v: unknown) { return this.add((p) => `${q(c)} = ${p(v)}`) }
  neq(c: string, v: unknown) { return this.add((p) => `${q(c)} <> ${p(v)}`) }
  gt(c: string, v: unknown) { return this.add((p) => `${q(c)} > ${p(v)}`) }
  gte(c: string, v: unknown) { return this.add((p) => `${q(c)} >= ${p(v)}`) }
  lt(c: string, v: unknown) { return this.add((p) => `${q(c)} < ${p(v)}`) }
  lte(c: string, v: unknown) { return this.add((p) => `${q(c)} <= ${p(v)}`) }
  like(c: string, v: string) { return this.add((p) => `${q(c)}::text like ${p(v)}`) }
  ilike(c: string, v: string) { return this.add((p) => `${q(c)}::text ilike ${p(v)}`) }
  is(c: string, v: null | boolean) { return this.add(() => `${q(c)} is ${v === null ? 'null' : v ? 'true' : 'false'}`) }
  in(c: string, vals: unknown[]) { return this.add((p) => `${q(c)}::text = any(${p(vals.map(String))})`) }
  contains(c: string, v: unknown[]) { return this.add((p) => `${q(c)} @> ${p(v)}`) }
  not(c: string, op: string, v: unknown) {
    if (op === 'is') return this.add(() => `${q(c)} is not ${v === null ? 'null' : String(v)}`)
    throw new Error(`unsupported not(${op})`)
  }
  or(expr: string) { this.conds.push(parseNested(expr, 'or')); return this }
  order(c: string, o?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push(`${q(c)} ${o?.ascending === false ? 'desc' : 'asc'}${o?.nullsFirst === undefined ? '' : o.nullsFirst ? ' nulls first' : ' nulls last'}`)
    return this
  }
  limit(n: number) { this.lim = n; return this }
  range(from: number, to: number) { this.off = from; this.lim = to - from + 1; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }
  // Like supabase-js, errors unless exactly one row came back.
  single() { this.singleMode = 'one'; return this }

  then<A, B>(ok?: ((r: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, bad)
  }

  private async run(): Promise<Result> {
    const params: unknown[] = []
    const p = (v: unknown) => { params.push(v); return `$${params.length}` }
    const where = () => (this.conds.length ? ' where ' + this.conds.map((c) => c.sql(p)).join(' and ') : '')
    let info: Awaited<ReturnType<typeof tableInfo>>
    try {
      info = await tableInfo(this.table)
    } catch (e) {
      return { data: null, error: { message: (e as Error).message, code: '42P01' } }
    }
    const jsonish = (col: string, v: unknown) => {
      const t = info.cols.get(col)?.type
      if (v !== null && v !== undefined && (t === 'jsonb' || t === 'json') && typeof v !== 'string') return JSON.stringify(v)
      return v
    }
    const t = `public.${q(this.table)}`
    let sql: string
    try {
      if (this.mode === 'select') {
        const colSql = this.head ? '1' : this.cols === '*' ? '*' : this.cols.split(',').map((c) => q(c.trim())).join(', ')
        sql = `select ${colSql} from ${t}${where()}`
        if (this.orders.length) sql += ' order by ' + this.orders.join(', ')
        if (this.lim !== null) sql += ` limit ${this.lim}`
        if (this.off) sql += ` offset ${this.off}`
      } else if (this.mode === 'insert' || this.mode === 'upsert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
        const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
        const values = rows.map((r) => '(' + keys.map((k) => (k in r ? p(jsonish(k, r[k])) : 'default')).join(', ') + ')')
        sql = `insert into ${t} (${keys.map(q).join(', ')}) values ${values.join(', ')}`
        if (this.mode === 'upsert') {
          const target = this.onConflict ?? info.pk
          const upd = keys.filter((k) => !target.includes(k))
          sql += ` on conflict (${target.map(q).join(', ')}) ` + (upd.length ? `do update set ${upd.map((k) => `${q(k)} = excluded.${q(k)}`).join(', ')}` : 'do nothing')
        }
        if (this.returning) sql += ' returning *'
      } else if (this.mode === 'update') {
        const entries = Object.entries(this.payload as Record<string, unknown>)
        const set = entries.map(([k, v]) => `${q(k)} = ${p(jsonish(k, v))}`).join(', ')
        sql = `update ${t} set ${set}${where()}${this.returning ? ' returning *' : ''}`
      } else {
        sql = `delete from ${t}${where()}${this.returning ? ' returning *' : ''}`
      }
      const res = await servicePool().query(sql, params)
      let data: unknown = this.head ? null : res.rows
      const mutation = this.mode !== 'select'
      if (mutation && !this.returning) data = null
      if (this.singleMode && Array.isArray(data)) {
        if (this.singleMode === 'one' && data.length !== 1) return { data: null, error: { message: `JSON object requested, multiple (or no) rows returned (${data.length})`, code: 'PGRST116' } }
        if (this.singleMode === 'maybe' && data.length > 1) return { data: null, error: { message: 'multiple rows returned', code: 'PGRST116' } }
        data = data[0] ?? null
      }
      return { data, error: null, count: this.wantCount || this.head ? res.rowCount : null }
    } catch (e) {
      const err = e as { message: string; code?: string }
      return { data: null, error: { message: err.message, code: err.code } }
    }
  }
}

function userFromRow(r: Record<string, unknown>, providers: string[]) {
  return {
    id: r.id as string,
    email: (r.email as string | null) ?? undefined,
    phone: (r.phone as string | null) ?? undefined,
    created_at: r.created_at as string,
    last_sign_in_at: (r.last_sign_in_at as string | null) ?? undefined,
    email_confirmed_at: (r.email_confirmed_at as string | null) ?? undefined,
    banned_until: (r.banned_until as string | null) ?? undefined,
    app_metadata: r.raw_app_meta_data,
    identities: providers.map((provider) => ({ provider })),
  }
}

export async function loadAuthUser(id: string) {
  const u = await adminPool().query(`select id, email, phone, created_at, last_sign_in_at, email_confirmed_at, banned_until, raw_app_meta_data from auth.users where id = $1`, [id])
  if (!u.rows[0]) return null
  const i = await adminPool().query(`select provider from auth.identities where user_id = $1`, [id])
  return userFromRow(u.rows[0], i.rows.map((r) => r.provider))
}

/** The slice of GoTrue's admin API the routes call. */
const authAdmin = {
  async getUserById(id: string) {
    const user = await loadAuthUser(id)
    return { data: { user }, error: user ? null : { message: 'User not found' } }
  },
  async updateUserById(id: string, attrs: { ban_duration?: string; email_confirm?: boolean }) {
    try {
      if (attrs.ban_duration !== undefined) {
        const hours = attrs.ban_duration === 'none' ? null : Number(attrs.ban_duration.replace('h', ''))
        await adminPool().query(`update auth.users set banned_until = ${hours === null ? 'null' : `now() + make_interval(hours => $2)`} where id = $1`, hours === null ? [id] : [id, hours])
      }
      if (attrs.email_confirm) await adminPool().query(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1`, [id])
      return { data: { user: await loadAuthUser(id) }, error: null }
    } catch (e) {
      return { data: { user: null }, error: { message: (e as Error).message } }
    }
  },
  async deleteUser(id: string) {
    try {
      await adminPool().query(`delete from auth.users where id = $1`, [id])
      return { data: null, error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  },
}

export function createPgServiceClient() {
  return {
    from: (table: string) => new Builder(table),
    async rpc(name: string, args: Record<string, unknown> = {}) {
      const keys = Object.keys(args)
      const call = keys.map((k, i) => `${k} => $${i + 1}`).join(', ')
      try {
        const res = await servicePool().query(`select * from public.${q(name)}(${call})`, keys.map((k) => args[k]))
        const first = res.fields[0]?.name
        const scalar = res.fields.length === 1 && first === name
        return { data: scalar ? res.rows[0]?.[first!] ?? null : res.rows, error: null }
      } catch (e) {
        const err = e as { message: string; code?: string }
        return { data: null, error: { message: err.message, code: err.code } }
      }
    },
    auth: { admin: authAdmin },
  }
}
