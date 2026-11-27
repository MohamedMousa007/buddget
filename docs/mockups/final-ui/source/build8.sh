#!/bin/bash
# Usage: build8.sh <out.html>   (serialised with a lock: parallel agents share build/app.css and proto.html)
set -e
D=/private/tmp/claude-501/-Users-mohamedmousa-Desktop-Budget-Manager-buddget--claude-worktrees-flow-page-ui-redesign-53d70f/44d4d9ca-47df-44cd-9e64-ccc27a7f75dd/scratchpad
OUT=${1:-light-touch-v8.html}
until mkdir "$D/build/v8/.lock" 2>/dev/null; do sleep 2; done
trap 'rmdir "$D/build/v8/.lock"' EXIT
cd "$D/build"
python3 mklt.py >/dev/null
# icons: every ICON('name') used anywhere, plus the existing sprite
names=$(cat lt*.js v8/lt-v8-*.js ../lt-src.html 2>/dev/null | grep -oE "ICON\('[a-z0-9-]+'" | sed -E "s/ICON\('//; s/'//" | sort -u)
L="/Users/mohamedmousa/Desktop/Budget Manager/buddget/node_modules/lucide-react/dist/esm/icons"
ok=""; for n in $names $(grep -oE 'id="i-[a-z0-9-]+"' sprite-lt.svg | sed -E 's/id="i-//; s/"//'); do [ -f "$L/$n.js" ] && ok="$ok $n"; done
node icons.mjs $(echo $ok | tr ' ' '\n' | sort -u) > sprite-lt.svg
python3 v8/mk8.py
python3 build.py lt8-src.html "$OUT"
echo "built $D/$OUT"
