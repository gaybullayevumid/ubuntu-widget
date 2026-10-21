#!/usr/bin/env bash
# Read-only checks of the project in this directory:
#   - metadata.json is valid JSON with required fields and a matching settings schema
#   - the GSettings schema compiles (compiled into a temporary directory, not the project)
#   - every JavaScript file parses as an ES module (gjs -m, stops at link time so no code runs)
#   - every relative import resolves to an existing file
#   - the standalone monitor smoke test runs (tests/smoke.js)
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
cd "$PROJECT_DIR"

fail=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fail=1; }

echo "metadata.json"
python3 - <<'PY' && ok "valid, required fields present" || bad "metadata.json invalid"
import json, sys
m = json.load(open("metadata.json"))
for k in ("uuid", "name", "description", "shell-version"):
    if k not in m: sys.exit(f"missing {k}")
if m.get("settings-schema") != "org.gnome.shell.extensions.systemmonitor": sys.exit("schema id mismatch")
PY

echo "GSettings schema"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
if out="$(glib-compile-schemas --strict --targetdir="$tmp" schemas 2>&1)"; then ok "compiles"; else bad "$out"; fi

echo "JavaScript syntax"
while IFS= read -r f; do
    out="$(timeout 10 gjs -m "$f" 2>&1 </dev/null)"
    if grep -q "SyntaxError" <<<"$out"; then bad "$f: $out"; else ok "$f"; fi
done < <(find . -name '*.js' -not -path './.git/*' | sort)

echo "Relative imports"
python3 - <<'PY' && ok "all resolve" || bad "unresolved import"
import re, pathlib, sys
rc = 0
for f in pathlib.Path(".").rglob("*.js"):
    if ".git" in f.parts: continue
    for spec in re.findall(r"from\s+'(\.[^']+)'", f.read_text()):
        if not (f.parent / spec).exists():
            print(f"    {f}: missing {spec}"); rc = 1
sys.exit(rc)
PY

echo "Monitor smoke test"
if out="$(timeout 30 gjs -m tests/smoke.js 2>&1)"; then ok "passed"; else bad "$out"; fi

[[ $fail -eq 0 ]] && echo "All checks passed." || { echo "Some checks FAILED."; exit 1; }
