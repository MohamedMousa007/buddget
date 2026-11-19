# QA Session 06: compare live generated Supabase types with checked-in database.types.ts (tables/columns/functions, public schema).
# Usage: python -I e2e/api/types-drift.py <live_types_file(json or ts)> <local.ts> [label]
import json, re, sys
def load(p):
    s = open(p, encoding='utf8').read()
    if s.lstrip().startswith('{'):
        try: s = json.loads(s).get('types', s)
        except Exception: pass
    return s
def parse(s):
    i = s.find('public: {'); s = s[i:] if i >= 0 else s
    out = {'Tables': {}, 'Views': {}, 'Functions': set()}
    for sec in ('Tables', 'Views'):
        m = re.search(r'\n    %s: \{\n(.*?)\n    \}\n' % sec, s, re.S)
        if not m: continue
        for t in re.finditer(r'\n      (\w+): \{\n        Row: \{\n(.*?)\n        \}', '\n' + m.group(1), re.S):
            out[sec][t.group(1)] = dict(re.findall(r'^          (\w+): (.+)$', t.group(2), re.M))
    m = re.search(r'\n    Functions: \{\n(.*?)\n    \}\n    Enums', s, re.S)
    if m: out['Functions'] = set(re.findall(r'^      (\w+):', m.group(1), re.M))
    return out
live, loc = parse(load(sys.argv[1])), parse(load(sys.argv[2]))
print('==', sys.argv[3] if len(sys.argv) > 3 else sys.argv[2])
for sec in ('Tables', 'Views'):
    L, C = live[sec], loc[sec]
    print(sec, 'live', len(L), 'local', len(C))
    print('  only live :', sorted(set(L) - set(C)))
    print('  only local:', sorted(set(C) - set(L)))
    for t in sorted(set(L) & set(C)):
        a, b = set(L[t]), set(C[t])
        if a - b: print('  %s cols only live :' % t, sorted(a - b))
        if b - a: print('  %s cols only local:' % t, sorted(b - a))
        for col in sorted(a & b):
            if L[t][col] != C[t][col]: print('  %s.%s type live=%s local=%s' % (t, col, L[t][col], C[t][col]))
print('Functions live', len(live['Functions']), 'local', len(loc['Functions']))
print('  only live :', sorted(live['Functions'] - loc['Functions']))
print('  only local:', sorted(loc['Functions'] - live['Functions']))
