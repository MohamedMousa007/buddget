#!/usr/bin/env python3
"""S3 re-run: compares the first run (.claude/s3-diff-run1.json) with the current one (.claude/s3-diff.json), message by message.
Read only. Usage: python3 scripts/qa/s3-rerun-compare.py > .claude/s3-parts/compare.txt"""
import json, collections
a = {r['id']: r for r in json.load(open('.claude/s3-diff-run1.json'))}
b = {r['id']: r for r in json.load(open('.claude/s3-diff.json'))}
def key(r): return (r['type'], r['decision'], r['prop_s'])
same, changed, gone, new = [], [], [], []
for i in sorted(set(a) | set(b)):
    ra, rb = a.get(i), b.get(i)
    ta = ra and ra['type']; tb = rb and rb['type']
    if ra is None: new.append(i)
    elif rb is None: gone.append(i)
    elif not ta and not tb: continue
    elif not ta: new.append(i)
    elif not tb: gone.append(i)
    elif key(ra) == key(rb): same.append(i)
    else: changed.append(i)
print('same', len(same), 'changed', len(changed), 'disappeared', len(gone), 'new', len(new))
print('| log | user | first run | this run | reason |\n|---|---|---|---|---|')
def reason(ra, rb):
    ta = ra['type'] if ra else None; tb = rb['type'] if rb else None
    if ta and ta.startswith('T5') and tb and tb.startswith('T5'): return 'council verdict 1: via-card rows flag only, no longer a spending change'
    if tb and tb.startswith('T15c'): return 'council verdict 4: crosses a month, skipped'
    if tb and tb.startswith('T11') and ta and ta.startswith('T11'): return 'carries the new `topup_repaired` flag (S2d)'
    if rb and ra and 'wallet_unregistered' in rb['prop_s'] and 'wallet_unregistered' not in ra['prop_s']: return 'S2d stamps `wallet_unregistered` on this credit (forward rule); the repair type is unchanged'
    if tb and tb.startswith('T16') and not ta: return 'S2d now stamps `wallet_unregistered` on this credit (a flag-only difference)'
    if tb and tb.startswith('P'): return 'arrived after the first run; booked by newer code'
    return ''
for i in changed + gone + new:
    ra, rb = a.get(i), b.get(i)
    f = lambda r: f"{r['type']} / {r['decision']}" if r and r['type'] else 'no difference'
    user = (rb or ra)['user']
    print(f"| `{i}` | `{user}` | {f(ra)} | {f(rb)} | {reason(ra, rb)} |")
