#!/bin/sh
# One-shot installer for the Aisle Match admin console. Safe to run again.
# Run it with:  sh setup.sh      (from the folder it lives in)
# Before you run it: create an EMPTY public repo called aislematch-admin on GitHub
#   (github.com/new, owner FrancisHilfiger, no README, no .gitignore).
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/aislematch-admin"
APP="${APP:-$HOME/bloom/bloom-app}"
ADMINS="kass@aislematch.com.au,kerri@aislematch.com.au,chevvy@aislematch.com.au"

echo "1/5  Copying the console to $DEST"
mkdir -p "$DEST"
(cd "$SRC" && tar cf - --exclude=node_modules --exclude=dist --exclude=.git --exclude=test/shots --exclude=setup.sh .) | (cd "$DEST" && tar xf -)
cd "$DEST"

echo "2/5  Installing build tools"
npm install --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund
[ -d .git ] || { git init -q; git branch -M main; }
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/FrancisHilfiger/aislematch-admin.git

echo "3/5  Putting the admin-api function into your app project ($APP)"
if [ ! -d "$APP/supabase" ]; then echo "Cannot find $APP/supabase. Run again like:  APP=/path/to/bloom-app sh setup.sh"; exit 1; fi
mkdir -p "$APP/supabase/functions/admin-api"
cp supabase/functions/admin-api/index.ts "$APP/supabase/functions/admin-api/index.ts"

echo "4/5  Setting the admin list and deploying the function"
(cd "$APP" && supabase secrets set ADMIN_EMAILS="$ADMINS" ALLOWED_ORIGINS="https://aislematch.com.au,https://www.aislematch.com.au" && supabase functions deploy admin-api --no-verify-jwt)

echo "5/5  Releasing the script to GitHub as version 1.0.0"
if ! git ls-remote origin >/dev/null 2>&1; then
  echo ""; echo "GitHub says the repo does not exist yet (or you are not logged in)."
  echo "Create an empty public repo at github.com/new named aislematch-admin, then run:  sh setup.sh"; exit 1
fi
if git rev-parse 1.0.0 >/dev/null 2>&1; then echo "Tag 1.0.0 already exists, skipping release. Use: sh release.sh 1.0.1"; else sh release.sh 1.0.0; fi

echo ""
echo "DONE. Still to do by hand (2 minutes):"
echo "  A. Supabase SQL editor: paste and run  $DEST/sql/14_admin_console.sql"
echo "  B. Webflow: new page with slug 'admin', add ONE embed with the contents of  $DEST/webflow-embed.html"
echo "     (paste your Supabase anon key where it says PASTE_YOUR_SUPABASE_ANON_KEY_HERE, same key as the vendor portal embed)"
echo "  C. Open https://aislematch.com.au/admin, sign in, then check the System page says OK on every line."
