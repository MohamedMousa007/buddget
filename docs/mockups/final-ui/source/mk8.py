"""lt8-src.html = lt-src.html (light touch v7) + round-8 files in build/v8, both phones on light touch."""
import pathlib, re, sys
D = pathlib.Path(__file__).resolve().parent.parent.parent
V8 = D / 'build/v8'
s = (D / 'lt-src.html').read_text()
def sub(a, b):
    global s
    assert a in s, a[:90]
    s = s.replace(a, b, 1)
js = ''.join(p.read_text() + '\n' for p in sorted(V8.glob('lt-v8-*.js')))
sub('/* ---------- page controls ---------- */', js + '\n/* ---------- page controls ---------- */')
pages = [('accounts', 'Accounts'), ('wealth', 'Savings'), ('goals', 'Goals'), ('debts', 'Debts'), ('paydays', 'Income'), ('flow', 'Flow')]
s = re.sub(r'(<div class="pz-seg" role="group" aria-label="Page" id="pz-page"[^>]*>).*?(</div>)', lambda m: m.group(1) + ''.join(f'<button type="button" data-page="{k}" aria-pressed="{str(k == "accounts").lower()}">{l}</button>' for k, l in pages) + '<button type="button" data-page="insights" hidden></button>' + m.group(2), s, count=1, flags=re.S)
s = re.sub(r'<header class="pz-head">.*?</header>', '''<header class="pz-head">
    <span class="pz-label">buddget · Final UI adjustments · round 8</span>
    <h1>Today's app next to the final design, page by page</h1>
    <p>Left: the light-touch app as it is live now. Right: the final design from the owner's 16 points and the council decisions. Both phones run on the app's compiled stylesheet and component markup with sample data. Pick a page, open a sheet from the bar, and tap rows on the right phone to open the new detail pages.</p>
  </header>''', s, count=1, flags=re.S)
sub('Current app <small>live design today</small>', 'Today <small>light touch, live now</small>')
sub('Light touch <small>proposed</small>', 'Final <small>round 8</small>')
sub('function mount(el, design) {', 'function mount(el, design, v7) {')
sub('const S = { el, st: makeState(design),', 'const S = { el, v7: !!v7, st: Object.assign(makeState(design), { v7: !!v7 }),')
sub('S.st = makeState(d);', 'S.st = Object.assign(makeState(d), { v7: !!S.v7 });')
sub("mount(document.querySelector('[data-screen=\"current\"]'), 'current')", "mount(document.querySelector('[data-screen=\"current\"]'), 'M', true)")
sub("setGeist()\nsetTheme('light')", "setGeist(); { const el = document.querySelector('[data-screen=\"current\"]'); const stack = \"'Geist', ui-sans-serif, system-ui, sans-serif\"; el.style.fontFamily = stack; ['--font-sans', '--font-heading', '--font-mono'].forEach((v) => el.style.setProperty(v, stack)) }\nsetTheme('light')")
sub("setPage('flow')\n})()", "setPage('accounts')\n})()")
cov = (D / 'build/coverage.html').read_text()
cov8 = V8 / 'coverage8.html'
sub(cov, cov8.read_text() if cov8.exists() else '')
s = s.replace('</style>', '#pz-page [data-page=insights] + [data-page=goals]{display:none} .pz-bar:has(#pz-states){display:none}\n</style>', 1)
s = s.replace('<title>Light Touch Comparison</title>', '<title>Final UI Round 8</title>', 1)
(D / 'lt8-src.html').write_text(s)
print('lt8-src ok')
