#!/usr/bin/env bash
# Deploy sin ventana de error: buildea a un dir aparte, conserva los assets
# estáticos del build anterior (pestañas abiertas siguen pidiendo chunks viejos)
# y recién ahí hace el swap + pm2 reload.
#
# Uso: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> chequeo RAM (el build necesita >700MB de heap)"
free -m | head -2

echo "==> build a .next-fresh"
rm -rf .next-fresh
NEXT_DIST_DIR=.next-fresh npm run build

echo "==> conservo chunks del build anterior para pestañas abiertas"
if [ -d .next/static ]; then
    # -n: no pisar los archivos nuevos; los hashes viejos que no colisionan se suman
    cp -rn .next/static/. .next-fresh/static/ 2>/dev/null || true
fi

echo "==> swap atómico"
rm -rf .next-old
if [ -d .next ]; then mv .next .next-old; fi
mv .next-fresh .next

echo "==> pm2 reload"
pm2 reload tubular-configurador --update-env

sleep 3
code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/configurador)
if [ "$code" != "200" ]; then
    echo "!! smoke test falló ($code) — rollback"
    mv .next .next-broken
    mv .next-old .next
    pm2 reload tubular-configurador --update-env
    exit 1
fi
echo "==> OK ($code). Build anterior en .next-old"
