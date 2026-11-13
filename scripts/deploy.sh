#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (the token in use has no workflow scope).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="${REPO:-https://github.com/hkmpn9s6dh-commits/hackathon-2026-mo-tong.git}"

npm run build
STAGE="$(mktemp -d)"
cp -r dist/* "$STAGE"/
touch "$STAGE/.nojekyll"
cd "$STAGE"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="mo-tong" -c user.email="mo-tong@users.noreply.github.com" commit -qm "deploy: $(date -u +%Y-%m-%dT%H:%MZ)"
git remote add origin "$REPO"
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  git -c http.proxy= -c https.proxy= push -f origin gh-pages
echo "deployed to $REPO (gh-pages)"
