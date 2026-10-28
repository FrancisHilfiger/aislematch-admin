#!/bin/sh
set -e
npx esbuild src/main.js --bundle --minify --format=iife --target=es2019 --loader:.css=text --legal-comments=none --outfile=dist/admin.js
cp dist/admin.js admin.js
echo "Built admin.js ($(wc -c < admin.js) bytes)"
