# QA Session 06: static scan of Supabase query chains in route handlers and server libs.
# Flags (1) select chains with no limit/range/single/maybeSingle/head and (2) awaited queries inside for/while loops (N+1).
# Usage: python -I e2e/api/scan-queries.py src/app/api src/lib/server
import os, re, sys
def files(roots):
    for r in roots:
        for d, _, fs in os.walk(r):
            for f in fs:
                if f.endswith('.ts') and '.test.' not in f and '__tests__' not in d: yield os.path.join(d, f)
for p in files(sys.argv[1:]):
    src = open(p, encoding='utf8').read()
    for m in re.finditer(r"\.from\('(\w+)'\)\s*\.select\(", src):
        end = src.find(';', m.end()); seg = src[m.start(): end if end > 0 else m.end() + 600]
        seg = seg[:900]
        if re.search(r"\.(limit|range|single|maybeSingle)\(|head:\s*true", seg): continue
        if re.search(r"\.in\('|\.eq\('(id|user_id)'", seg) and m.group(1) not in ('expenses','income_events','sms_parse_log','savings_transactions','debt_payments','notifications','app_analytics_events'):
            tag = 'scoped'
        else: tag = 'UNBOUNDED?'
        line = src.count('\n', 0, m.start()) + 1
        print(f"{tag:10} {p.replace(os.sep,'/')}:{line} {m.group(1)} :: {' '.join(seg.split())[:150]}")
    lines = src.split('\n'); depth = []
    for i, l in enumerate(lines):
        if re.search(r"^\s*for\s*\(|^\s*while\s*\(|\.forEach\(", l): depth.append(i)
        if depth and re.search(r"await .*(\.from\(|\.rpc\(|auth\.admin)", l) and i - depth[-1] < 25:
            print(f"LOOP-AWAIT {p.replace(os.sep,'/')}:{i+1} {l.strip()[:140]}")
