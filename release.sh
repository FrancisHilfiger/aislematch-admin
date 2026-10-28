#!/bin/sh
# Usage:  sh release.sh 1.0.1
# Builds admin.js, commits, pushes, and tags. Refuses to reuse a tag (jsDelivr caches tags forever).
set -e
V="$1"
if [ -z "$V" ]; then echo "Usage: sh release.sh <version>   e.g. sh release.sh 1.0.1"; exit 1; fi
if git rev-parse "$V" >/dev/null 2>&1; then echo "Tag $V already exists. Pick the next number."; exit 1; fi
sh build.sh
git add -A
git commit -m "Admin console $V" || echo "(nothing new to commit)"
git push -u origin main
git tag "$V"
git push origin "$V"
echo ""
echo "Released $V. In Webflow, set the embed script to:"
echo "  https://cdn.jsdelivr.net/gh/FrancisHilfiger/aislematch-admin@$V/admin.js"
