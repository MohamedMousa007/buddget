#!/usr/bin/env python3
"""S3 dry run, analysis half. Read only: reads local files, never connects to a database.

Inputs (all under .claude/, git-ignored):
  sms-s2c-replay.json   export of scripts/qa/sms-s2c-replay-inputs.sql
  s3-replay-dump.json   TZ=Africa/Cairo npx vitest run -c scripts/qa/s3-vitest.config.ts
  s3-live.json          per-row live money rows, see scripts/qa/s3-live-inputs.sql
Output: .claude/s3-diff.json (every record) and .claude/s3-parts/*.md (the tables of docs/launch/S3-dryrun.md).
Usage: python3 scripts/qa/s3-dryrun-report.py
"""
import json, collections, os
from datetime import datetime, timedelta

D = json.load(open('.claude/s3-replay-dump.json'))
L = json.load(open('.claude/s3-live.json'))
X = json.load(open('.claude/sms-s2c-replay.json'))
os.makedirs('.claude/s3-parts', exist_ok=True)

NON = {'Transfer', 'CC Payoff', 'ATM Cash Withdrawal', 'Installment', 'Currency Exchange'}
XL = {r[0]: r for r in X['logs']}  # id,u,kind,status,parse_method,amount,currency,acct,cp,cphash,self,ref,device,received,dup,await,paired,...
LG = {r[0]: r for r in L['logs']}  # id,user8,status,confirmed,await,verdict,bank_source,format_key,shape_key,revoked,tmpl,method,has_raw,has_bal,recv,bank,sender,discard,wg,exp_id,inc_id
U8 = {r[0]: r[1] for r in L['logs']}
lexp, linc = collections.defaultdict(list), collections.defaultdict(list)
for r in L['exp']: lexp[r[0]].append(r)
for r in L['inc']: linc[r[0]].append(r)
A, B, C = D['A'], D['B'], D['C']
VIA_CARD = ['51966294', '5fe0a498', '6cde6c02', '81144634', '82133010', 'b61afd88', 'c18dabf3']
CASH_DEP = ['cb5fd476', '78e0b305', '0812aa55', '818b0736']
NOTICES = [i for i, r in D['rules'].items() if r['notice']]

# --- live rows by message --------------------------------------------------------------------------------------------
def live_rows(i):
    e = [r for r in lexp[i] if not r[23] and r[15] is None]
    f = [r for r in lexp[i] if r[23] and r[15] is None]
    n = [r for r in linc[i] if r[11] is None]
    return e, f, n

def e_state(cat, refunded, excl):
    if refunded: return 'netzero'
    if excl: return 'excluded'
    return 'nonspend' if cat in NON else 'spend'

def live_state(i):
    e, f, n = live_rows(i)
    rows = []
    for r in e:
        rows.append(dict(t='E', cls=e_state(r[2], r[11], r[12]), cat=r[2], amt=float(r[3]), ccy=r[4], day=r[5], pm=r[7], refund=(r[9], r[10]), flags=r[13] or [], excl=r[12]))
    for r in f:
        rows.append(dict(t='F', cls=e_state(r[2], r[11], r[12]), cat=r[2], amt=float(r[3]), ccy=r[4], day=r[5], pm=r[7], refund=(r[9], r[10]), flags=r[13] or [], excl=r[12]))
    for r in n:
        rows.append(dict(t='I', cls='income_excluded' if r[8] else 'income', cat=r[2], amt=float(r[3]), ccy=r[4], day=r[5], pm=r[7], refund=(None, None), flags=r[9] or [], excl=r[8]))
    return rows

def rep_state(run, i):
    a = run[i]
    rows = []
    for e in a['exp']:
        if e['deleted_at'] is not None: continue
        rows.append(dict(t='F' if e['fee'] else 'E', cls=e_state(e['category'], e['refunded_at'] is not None, e['spend_exclusion']), cat=e['category'], amt=float(e['amount']), ccy=e['currency'], day=e['expense_date'], pm=e['payment_method_id'], refund=(e['refund_kind'], e['refund_sms_log_id']), flags=e['sms_flags'] or [], excl=e['spend_exclusion']))
    for e in a['inc']:
        if e['deleted_at'] is not None: continue
        rows.append(dict(t='I', cls='income_excluded' if e['exclusion'] else 'income', cat=e['source_type'], amt=float(e['amount']), ccy=e['currency'], day=e['received_date'], pm=e['payment_method_id'], refund=(None, None), flags=e['sms_flags'] or [], excl=e['exclusion']))
    return rows

# --- proposed state: replay A, with the route-level rules the replay does not run, and C for the masked-digit rows -------
def proposed(i):
    if i in NOTICES: return [], 'collected notice: not a transaction (decided before every tier)'
    if i in VIA_CARD: return rep_state(C, i), 'via-card payment: spending, flagged model_kind_unproven (needs digits restored: run C)'
    return rep_state(A, i), 'replay A'

def month(day): return day[:7]

def effect(rows):
    out = collections.Counter()
    for r in rows:
        if r['t'] in ('E', 'F') and r['cls'] == 'spend': out[(r['ccy'], month(r['day']), 'spend')] += r['amt']
        if r['t'] == 'I' and r['cls'] == 'income': out[(r['ccy'], month(r['day']), 'income')] += r['amt']
    return out

def desc(rows):
    if not rows: return 'none'
    parts = []
    for r in rows:
        k = {'E': '', 'F': 'fee ', 'I': 'income '}[r['t']]
        parts.append(f"{k}{r['cls']} {r['cat']} {r['amt']:g} {r['ccy']} {r['day']}" + (f" refund<-{r['refund'][1]}" if r['refund'][1] else '') + (f" flags={','.join(r['flags'])}" if r['flags'] else ''))
    return '; '.join(parts)

# --- user-touch signals --------------------------------------------------------------------------------------------------
def touched(i):
    """Strong signals only: the user, not the server, did this. Returns a list of reasons."""
    out = []
    for r in lexp[i]:
        if r[15] is not None and r[16] is None and not r[23]: out.append('row deleted by user (deleted_at set, no retraction marker)')
        if r[19]: out.append('notes written')
        if r[12]: out.append('spend_exclusion set')
        if r[14]: out.append('sms_flags_ack set')
    for r in linc[i]:
        if r[11] is not None and r[12] is None: out.append('income deleted by user')
        if r[15]: out.append('notes written')
        if r[8]: out.append('income exclusion set')
        if r[10]: out.append('sms_flags_ack set')
    if XL[i][3] == 'tapped': out.append('user tapped the held row')
    return sorted(set(out))

def weak(i):
    out = []
    for r in lexp[i]:
        if r[15] is None and not r[23]:
            if r[20] and r[20] != r[2]: out.append('category differs from the log category (user or categoriser)')
            if r[21]: out.append('account differs from the log account')
            if r[22]: out.append('description differs from the parsed title (user edit or server formatting)')
            if r[18] and r[17] and (datetime.fromisoformat(r[18].replace('Z', '+00:00')) - datetime.fromisoformat(r[17].replace('Z', '+00:00'))).total_seconds() > 60: out.append('edited_at after created_at by over a minute (also set by app sync)')
    return sorted(set(out))

# --- compare -----------------------------------------------------------------------------------------------------------
POST_DEPLOY = {k for k, v in X['created'].items() if v >= '2026-11-14T16:44'}  # created after the S2c code push (18:44 +02:00)
NOT_REPLAYABLE = {'50641027', 'cafcae46', '985f7ad6', 'b0854359', '6ad46d1d', 'eedf39da'}  # live pairs the replay cannot reproduce (closingReplay.test.ts item i)
DST_END = '2026-10-30'  # Cairo is UTC+3 until here, Riyadh always: before it the replay's Cairo day is right for both stored zones

def utc_day(i): return datetime.fromisoformat(XL[i][13].replace('Z', '+00:00')).date().isoformat()

def sibling(i):
    """Same user, same amount and currency, another message within 30 minutes: a top-up or an own transfer partner would look like this."""
    x = XL[i]; t = datetime.fromisoformat(x[13].replace('Z', '+00:00')); out = []
    for j, y in XL.items():
        if j == i or y[1] != x[1] or y[5] != x[5] or y[6] != x[6]: continue
        if abs((datetime.fromisoformat(y[13].replace('Z', '+00:00')) - t).total_seconds()) <= 1800: out.append(j)
    return out

recs = []
for i, x in XL.items():
    live = live_state(i)
    prop, why = proposed(i)
    ls = [r for r in live if r['t'] != 'F']; ps = [r for r in prop if r['t'] != 'F']
    ch = []
    lc = ','.join(sorted(r['cls'] for r in ls)) or 'none'; pc = ','.join(sorted(r['cls'] for r in ps)) or 'none'
    if lc != pc: ch.append('class')
    if len(ls) == len(ps) == 1:
        a, b = ls[0], ps[0]
        if abs(a['amt'] - b['amt']) > 0.005: ch.append('amount')
        if a['day'] != b['day']: ch.append('date')
        if a['refund'][1] != b['refund'][1] and (a['refund'][1] or b['refund'][1]): ch.append('refund mark')
        if sorted(a['flags']) != sorted(b['flags']): ch.append('flags')
        if (a['excl'] or None) != (b['excl'] or None) and b['excl']: ch.append('exclusion')
        if a['cat'] != b['cat'] and lc == pc: ch.append('category(info)')
        if (a['pm'] or None) != (b['pm'] or None) and lc == pc: ch.append('account(info)')
    if (x[16] or None) != (A[i]['paired'] or None): ch.append('pairing')
    recs.append(dict(id=i, user=U8[i], u=x[1], kind=x[2], method=x[4], ccy=x[6], status=x[3], live=ls, prop=ps, live_s=desc(ls), prop_s=desc(ps), changes=ch, why=why,
                     touched=touched(i), weak=weak(i), eff_live=effect(ls), eff_prop=effect(ps), skipped=A[i]['skipped'], refused=A[i]['refused'],
                     stamped=A[i]['stampedElsewhere'], logcat=next((r[20] for r in lexp[i]), None)))

money_ids = {r[1] for r in L['exp']} | {r[1] for r in L['inc']}
for r in recs:
    g = LG[r['id']]
    r['booked_gone'] = bool((g[19] or g[20]) and not r['live'] and not lexp[r['id']] and not linc[r['id']])
    r['acked_repeat'] = r['booked_gone'] and ((g[19] and g[19] in money_ids) or (g[20] and g[20] in money_ids))

APPLY, HOLD, NOCHANGE = 'apply', 'hold', 'no change'

def rtype(r):
    """Returns (repair type, class of decision, one-line reason). None when the message needs nothing."""
    i, ch = r['id'], r['changes']
    if i in POST_DEPLOY: return ('P post-deploy row (booked by the new code)', NOCHANGE, 'created after the S2c code push; the new code already decided it')
    if not ch or ch == ['category(info)'] or ch == ['account(info)'] or set(ch) <= {'category(info)', 'account(info)'}: return None
    if i in NOT_REPLAYABLE or (XL[i][16] and 'pairing' not in ch): return ('B replay-blind pair', NOCHANGE, 'live pair the replay cannot reproduce from masked text (direction or reference masked)')
    if i in NOT_REPLAYABLE: return None
    if i in NOTICES: return ('T3 collected-notice income removed', APPLY, 'I3: a "collected" notice is not a transaction')
    if i in CASH_DEP: return ('T4 cash deposit becomes transfer from cash', APPLY, 'council verdict (46aec162): neither income nor spending, a transfer from Cash, flagged cash_deposit')
    if i in VIA_CARD: return ('T5 via-card payment becomes spending', HOLD, 'I3 default, but the balance check on b61afd88 leans the other way (the payment raised the card balance): owner to read it first')
    lc = r['live'][0]['cls'] if r['live'] else 'none'; pc = r['prop'][0]['cls'] if r['prop'] else 'none'
    live_stamp = [x['refund'][1] for x in r['live'] if x['refund'][1]]
    prop_stamp = [x['refund'][1] for x in r['prop'] if x['refund'][1]]
    if r['refused'] and r['live']: return ('T7 same-capture copy has a live row', APPLY, 'I5')
    if lc == 'income' and pc == 'netzero': return ('T8 unmatched refund leaves income', APPLY, 'I1 and refund rule: no match, so outside income and spending, flagged refund_unmatched')
    if live_stamp and not prop_stamp:
        by = live_stamp[0]
        if XL.get(by, [None] * 3)[2] == 'declined': return ('T1 un-reverse (decline stamp removed)', APPLY, 'I2: a decline changes only its own row')
        if A.get(by, {}).get('stampedElsewhere'): return ('T2a refund mark moves away', APPLY, 'I1 rule (b): the same refund matches another row first (same account, same amount, 15 minutes)')
        return ('T2c refund stamp the new rules would not place', HOLD, 'live stamp placed by the old exact-amount rule; the replay cannot read the payment reference, so it may have been right')
    if prop_stamp and not live_stamp and r['kind'] not in ('declined', 'refund'): return ('T2b refund mark moves here', APPLY, 'I1 rule (b): same account, same amount, 15 minutes')
    if lc == 'none' and pc == 'netzero' and r['kind'] in ('declined', 'refund'): return ('T7b own net-zero row for a decline or unmatched refund', APPLY, 'I2 and refund rule: books one net-zero row of its own (no money effect)')
    if lc == 'none' and pc != 'none':
        if r['status'] == 'add_failed': return ('T6a never surfaced (add_failed)', HOLD, 'held row never answered; book or confirm absent')
        if r['touched']: return ('T6 no live row, replay books', NOCHANGE, 'user-deleted row')
        if r['booked_gone'] and not r['acked_repeat']: return ('T6e booked then removed', HOLD, 'the log points at a money row that no longer exists; a user purge cannot be told from a server removal')
        sib = sibling(r['id'])
        if r['kind'] in ('income', 'instant_transfer_in') and sib: return ('T6c income with an equal partner message', HOLD, 'looks like a wallet top-up or own-transfer credit; the replay cannot see the wallet state at arrival')
        if r['kind'] == 'income': return ('T6d confirmed income with no row', HOLD, 'confirmed but never booked; the replay cannot see why (wallet state at arrival)')
        return ('T6 lost row (confirmed, never booked)', APPLY, 'P3-4: book it (the claim returned 409 to the twin, or the answer was lost)')
    if lc == 'nonspend' and pc == 'spend':
        return ('T10 non-spend category on a purchase', HOLD, 'live category was changed after booking (log category differs): a user correction or an old relabel') if r['logcat'] != r['live'][0]['cat'] else ('T10b non-spend kind becomes spending', APPLY, 'I3')
    if lc == 'spend' and pc == 'nonspend': return ('T11 purchase at own wallet becomes transfer', APPLY, 'I3: own_wallet_exact settles alone')
    if lc == 'income' and pc == 'none': return ('T9 income leg retracted by a new pair', APPLY, 'I1 exception 2: pairing retracts the other leg')
    if 'class' in ch: return (f'T13 other class change {lc}->{pc}', HOLD, 'not covered by a rule above')
    if 'amount' in ch: return ('T14 amount', HOLD, 'amount differs')
    if 'date' in ch:
        if r['live'][0]['day'] == utc_day(r['id']) and r['prop'][0]['day'] != r['live'][0]['day'] and r['prop'][0]['day'] < DST_END: return ('T15 date: UTC day instead of local day', APPLY, 'P3-3: the stored day was the UTC day of the arrival, the local day differs')
        return ('T15b date differs, not the UTC pattern', HOLD, 'live day is neither the UTC nor the local day of arrival (body day, user edit, or November zone)')
    if 'flags' in ch: return ('T16 flag only', HOLD, 'possible_duplicate is an upper bound on masked text; no money effect')
    if 'pairing' in ch: return ('T17 pairing only', NOCHANGE, 'replay-only pair')
    return None

for r in recs:
    t = rtype(r)
    r['type'], r['decision'], r['reason'] = t if t else (None, None, None)
    # the repair never overwrites the user's own correction
    if r['type'] and r['decision'] == APPLY and r['touched']: r['decision'] = NOCHANGE; r['reason'] += ' | USER-TOUCHED: ' + '; '.join(r['touched'])

# an own net-zero row for a refund whose live stamp is on hold waits with it
hold_stamped = {x['refund'][1] for r in recs if r['decision'] == HOLD and r['type'] and r['type'].startswith('T2c') for x in r['live'] if x['refund'][1]}
for r in recs:
    if r['type'] and r['type'].startswith('T7b') and r['id'] in hold_stamped: r['decision'] = HOLD; r['reason'] += ' | held with the stamp it replaces (T2c)'

def key_eff(r):
    keys = set(r['eff_live']) | set(r['eff_prop'])
    return {k: round(r['eff_prop'].get(k, 0) - r['eff_live'].get(k, 0), 2) for k in keys if abs(r['eff_prop'].get(k, 0) - r['eff_live'].get(k, 0)) > 0.005}
for r in recs: r['eff'] = key_eff(r)

def fmt_eff(e):
    return '; '.join(f"{k[2]} {v:+g} {k[0]} {k[1]}" for k, v in sorted(e.items(), key=lambda kv: (kv[0][1], kv[0][2]))) or 'none'

typed = [r for r in recs if r['type']]
ap = [r for r in typed if r['decision'] == APPLY]; hd = [r for r in typed if r['decision'] == HOLD]; nc = [r for r in typed if r['decision'] == NOCHANGE]
json.dump([{k: (v if k not in ('eff_live', 'eff_prop', 'eff') else {'|'.join(kk): vv for kk, vv in v.items()}) for k, v in r.items()} for r in recs], open('.claude/s3-diff.json', 'w'), ensure_ascii=False)

def rowline(r, cols):
    return f"| `{r['id']}` | `{r['user']}` | {r['live_s']} | {r['prop_s']} | {', '.join(c for c in r['changes'] if '(info)' not in c) or '-'} | {fmt_eff(r['eff'])} | {r['type']}: {r['reason']} |\n"
HDR = '| log | user | live state | proposed state | fields | money effect | repair type: reason |\n|---|---|---|---|---|---|---|\n'
for name, rows in (('apply', ap), ('hold', hd), ('nochange', nc)):
    with open(f'.claude/s3-parts/{name}.md', 'w') as o:
        o.write(HDR)
        for r in sorted(rows, key=lambda r: (r['type'], r['u'], r['id'])): o.write(rowline(r, None))

def agg(rows, keyf):
    t = collections.defaultdict(lambda: [0, collections.Counter()])
    for r in rows:
        k = keyf(r); t[k][0] += 1
        for kk, v in r['eff'].items(): t[k][1][(kk[0], kk[2])] += v
    return t
def tbl(rows, keyf, title, fn):
    with open(f'.claude/s3-parts/{fn}.md', 'w') as o:
        o.write(f'| {title} | rows | net money effect (by currency) |\n|---|---|---|\n')
        for k, (n, e) in sorted(agg(rows, keyf).items()):
            o.write(f"| {k} | {n} | {'; '.join(f'{kk[1]} {v:+.2f} {kk[0]}' for kk, v in sorted(e.items())) or 'none'} |\n")
tbl(ap, lambda r: r['type'], 'repair type', 'by_type_apply'); tbl(hd, lambda r: r['type'], 'repair type', 'by_type_hold'); tbl(nc, lambda r: r['type'], 'type', 'by_type_nochange')
tbl(ap, lambda r: '`' + r['user'] + '`', 'user', 'by_user_apply')
pm = collections.defaultdict(collections.Counter)
for r in ap:
    for kk, v in r['eff'].items(): pm[(r['user'], kk[0], kk[1])][kk[2]] += v
with open('.claude/s3-parts/by_user_month.md', 'w') as o:
    o.write('| user | currency | month | spending | income |\n|---|---|---|---|---|\n')
    for k in sorted(pm):
        if abs(pm[k]['spend']) > 0.005 or abs(pm[k]['income']) > 0.005: o.write(f"| `{k[0]}` | {k[1]} | {k[2]} | {pm[k]['spend']:+.2f} | {pm[k]['income']:+.2f} |\n")

print('messages', len(recs), 'typed', len(typed), 'apply', len(ap), 'hold', len(hd), 'nochange', len(nc), 'post-deploy', len(POST_DEPLOY))
print('apply by type', collections.Counter(r['type'] for r in ap))
print('hold by type', collections.Counter(r['type'] for r in hd))
print('nochange by type', collections.Counter(r['type'] for r in nc))
print('category/account-only differences (never proposed):', sum(1 for r in recs if not r['type'] and r['changes']))
print('apply rows with weak signals:', sum(1 for r in ap if r['weak']))


# --- section 8 items, signals, carried items, sample -----------------------------------------------------------------
R = {r['id']: r for r in recs}
ITEMS = ['9e75b537', '572aaf39', '4a7d7250', '0fe8887c', 'baab5343', 'bfe884e3', 'e8b0e3ed', 'af7e8c15', *NOTICES, *CASH_DEP, *VIA_CARD, 'ff52e170', 'fa2a8ec2', 'ad8523cb', '10ac8181', '540077ff', 'acbe9dd7', '916e58d4', 'aa5ece0a', '02370960', 'dac3937a', 'e23c899a', '41c80815', 'fb2d543a', 'e66b72ae', 'a602aba1', '34a081d4']
with open('.claude/s3-parts/section8.md', 'w') as o:
    o.write('| log | live | proposed (replay) | decision | type |\n|---|---|---|---|---|\n')
    for i in ITEMS:
        r = R[i]; o.write(f"| `{i}` | {r['live_s']} | {r['prop_s'] if not r['skipped'] and not r['refused'] else (r['skipped'] or 'refused as copy of ' + r['refused']['of'])} | {r['decision'] or 'no difference'} | {r['type'] or '-'} |\n")
print('--- signals over all rows')
sig = collections.Counter(); wk = collections.Counter()
for r in recs:
    for t in r['touched']: sig[t] += 1
    for t in r['weak']: wk[t] += 1
print('strong', dict(sig)); print('weak', dict(wk))
eds = collections.Counter(q[18] for q in L['exp'])
print('edited_at values shared by 20+ expense rows:', {k: v for k, v in eds.items() if v >= 20})
print('rows with edited_at > created_at + 60s (expenses):', sum(1 for q in L['exp'] if q[18] and datetime.fromisoformat(q[18].replace('Z', '+00:00')) - datetime.fromisoformat(q[17].replace('Z', '+00:00')) > timedelta(seconds=60)), 'of', len(L['exp']))
print('touched among apply (demoted):', [(r['id'], r['type']) for r in nc if 'USER-TOUCHED' in r['reason']])
print('--- carried')
print('logs', len(L['logs']), 'no bank_source', sum(1 for l in L['logs'] if not l[6]), 'no format_key', sum(1 for l in L['logs'] if not l[7]), 'no shape_key', sum(1 for l in L['logs'] if not l[8]))
print('bank_name present', sum(1 for l in L['logs'] if l[15]), 'absent', sum(1 for l in L['logs'] if not l[15]), 'sender present', sum(1 for l in L['logs'] if l[16]))
print('revoked', sum(1 for l in L['logs'] if l[9]))
K = D['keys']
print('masked-body keys: logs with masked body', len(K), 'shape null', sum(1 for v in K.values() if v['shape'] is None), 'format null', sum(1 for v in K.values() if v['format'] is None), 'distinct format', len({v['format'] for v in K.values() if v['format']}))
st = [(i, l[8]) for i, l in LG.items() if l[8]]
print('stored shape_key rows', len(st), 'equal to the value from the masked body', sum(1 for i, sv in st if K.get(i, {}).get('shape') == sv))
# sample of 20 across repair types (deterministic: first row by id of each type, then second, ...)
bytype = collections.defaultdict(list)
for r in sorted(ap + hd, key=lambda r: r['id']): bytype[r['type']].append(r)
sample = []; k = 0
while len(sample) < 20 and any(len(v) > k for v in bytype.values()):
    for t in sorted(bytype):
        if len(bytype[t]) > k and len(sample) < 20: sample.append(bytype[t][k])
    k += 1
with open('.claude/s3-parts/sample.md', 'w') as o:
    o.write('| # | log | user | repair type | decision | live | proposed |\n|---|---|---|---|---|---|---|\n')
    for n, r in enumerate(sample, 1): o.write(f"| {n} | `{r['id']}` | `{r['user']}` | {r['type']} | {r['decision']} | {r['live_s']} | {r['prop_s']} |\n")
print('sample', len(sample), collections.Counter(r['type'] for r in sample))

print('--- extra counts')
t15 = [r for r in ap if r['type'].startswith('T15 ')]
print('T15 apply: expense rows', sum(1 for r in t15 if r['live'][0]['t'] == 'E'), 'income rows', sum(1 for r in t15 if r['live'][0]['t'] == 'I'), 'cross-month', sum(1 for r in t15 if r['live'][0]['day'][:7] != r['prop'][0]['day'][:7]), 'by user', dict(collections.Counter(r['user'] for r in t15)))
pd = [i for i, a in A.items() if any('possible_duplicate' in (e['sms_flags'] or []) for e in a['exp'] + a['inc'])]
print('replay possible_duplicate rows', len(pd), 'typed T16', sum(1 for i in pd if R[i]['type'] and R[i]['type'].startswith('T16')), 'other types', collections.Counter(R[i]['type'] for i in pd if not (R[i]['type'] or '').startswith('T16')))
print('stamp check: refunds with live stamps', {r[10]: r[1] for r in L['exp'] if r[10] and r[10] != r[0]})
print('replay stamps elsewhere', {i: a['stampedElsewhere'] for i, a in A.items() if a['stampedElsewhere']})
print('B (model-asserted kinds) differs from A on class for', sum(1 for i in A if A[i]['cls'] != B[i]['cls']), 'messages:', [(i, A[i]['cls'], B[i]['cls']) for i in A if A[i]['cls'] != B[i]['cls']][:12])
print('C (digits restored) differs from A on class for', sum(1 for i in A if A[i]['cls'] != C[i]['cls']), 'messages')

# top-up income candidates: a live income whose same-amount partner (a debit kind, same user and currency) arrived within 30 minutes
DEBITS = {'purchase', 'online_purchase', 'instant_transfer_out', 'own_transfer', 'cc_payoff', 'atm_withdrawal', 'currency_exchange'}
cand = []
for i, x in XL.items():
    if not linc[i] or all(q[11] for q in linc[i]): continue
    sib = [j for j in sibling(i) if XL[j][2] in DEBITS and XL[j][2] != 'atm_withdrawal']
    if sib: cand.append((i, R[i]['user'], x[2], x[5], x[6], [(j, XL[j][2]) for j in sib]))
print('top-up income candidates (live income with a same-amount debit partner within 30 minutes):', len(cand), dict(collections.Counter((c[1], c[4]) for c in cand)))
wallet = [c for c in cand if c[1] == 'f923c68b']
print('wallet user (SAR) candidates', len(wallet), 'sum SAR', round(sum(float(c[3]) for c in wallet), 2), 'of which a live partner is an own-wallet-exact transfer in the replay', sum(1 for c in wallet if any(R[j]['prop'] and R[j]['prop'][0]['cls'] == 'nonspend' for j, _ in c[5])))

with open('.claude/s3-parts/touched.md', 'w') as o:
    o.write('| log | user | what the replay would have done | live state | strong signal | decision |\n|---|---|---|---|---|---|\n')
    for r in sorted((r for r in typed if r['touched']), key=lambda r: (r['u'], r['id'])):
        o.write(f"| `{r['id']}` | `{r['user']}` | {r['type']} | {r['live_s']} | {'; '.join(r['touched'])} | {r['decision']} |\n")
print('typed rows with a strong user-touch signal', sum(1 for r in typed if r['touched']), dict(collections.Counter(r['decision'] for r in typed if r['touched'])))
print('apply rows whose only weak signal is the edited_at one:', sum(1 for r in ap if r['weak'] and all(w.startswith('edited_at') for w in r['weak'])), 'apply rows with a category/account/description weak signal:', sum(1 for r in ap if any(not w.startswith('edited_at') for w in r['weak'])))
