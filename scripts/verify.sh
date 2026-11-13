#!/usr/bin/env bash
# Mo Tong verification. Everything a judge (or a fresh clone) can re-run.
#   bash scripts/verify.sh          # typecheck + unit + build + hygiene + e2e
#   bash scripts/verify.sh --fast   # skips the build and the browser pass
set -uo pipefail

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

if ! command -v npm >/dev/null 2>&1; then
  export PATH="/c/Users/张一/.workbuddy/binaries/node/versions/22.22.2-6:$PATH"
fi

fail=0
say() { printf '%-48s %s\n' "$1" "$2"; }
ok() { say "$1" "PASS"; }
bad() { say "$1" "FAIL"; fail=$((fail + 1)); }

echo "Mo Tong verification $( [ $FAST -eq 1 ] && echo '(fast)' || echo '(full)' )"
echo "-------------------------------------------------------"

command -v node >/dev/null 2>&1 && ok "node available" || bad "node available"
command -v npm >/dev/null 2>&1 && ok "npm available" || bad "npm available"

if npx tsc --noEmit --pretty false >/tmp/mo-tong-tsc.log 2>&1; then ok "typescript type check"; else bad "typescript type check"; tail -6 /tmp/mo-tong-tsc.log; fi

if npx vitest run --reporter=dot >/tmp/mo-tong-unit.log 2>&1; then ok "core unit checks (23)"; else bad "core unit checks"; tail -14 /tmp/mo-tong-unit.log; fi

if [ $FAST -eq 0 ]; then
  if npm run build >/tmp/mo-tong-build.log 2>&1; then ok "production build"; else bad "production build"; tail -12 /tmp/mo-tong-build.log; fi
  [ -f dist/index.html ] && ok "dist/index.html exists" || bad "dist/index.html exists"
  if grep -q 'src="\./assets/' dist/index.html && grep -q 'href="\./assets/' dist/index.html; then
    ok "asset paths are relative (pages + static space)"
  else
    bad "asset paths are relative (pages + static space)"
  fi
fi

[ -f LICENSE ] && grep -qi "MIT License" LICENSE && ok "MIT licence present" || bad "MIT licence present"
[ -f README.md ] && grep -q "npm run build" README.md && ok "README has run instructions" || bad "README has run instructions"
[ -f ms_deploy.json ] && grep -q '"static"' ms_deploy.json && ok "ModelScope static deploy manifest" || bad "ModelScope static deploy manifest"
[ -f docs/00-BRIEF.md ] && ok "docs/00-BRIEF.md" || bad "docs/00-BRIEF.md"
[ -f docs/01-SPEC.md ] && ok "docs/01-SPEC.md" || bad "docs/01-SPEC.md"
[ -f docs/07-UI.md ] && ok "docs/07-UI.md" || bad "docs/07-UI.md"
[ -f docs/05-SUBMISSION.md ] && ok "docs/05-SUBMISSION.md" || bad "docs/05-SUBMISSION.md"

if grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist -E "(sk-[a-zA-Z0-9]{16,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{20,})" . >/tmp/mo-tong-secrets.log 2>&1; then
  bad "no api keys committed"; head -3 /tmp/mo-tong-secrets.log
else
  ok "no api keys committed"
fi

if [ $FAST -eq 0 ]; then
  if node scripts/e2e.mjs >/tmp/mo-tong-e2e.log 2>&1; then ok "browser end-to-end (9 checks)"; else bad "browser end-to-end"; tail -14 /tmp/mo-tong-e2e.log; fi
fi

echo "-------------------------------------------------------"
if [ $fail -eq 0 ]; then echo "all checks passed"; else echo "$fail check(s) failed"; fi
exit $(( fail > 0 ? 1 : 0 ))
