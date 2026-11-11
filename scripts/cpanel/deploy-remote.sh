#!/usr/bin/env bash
# Runs ON the cPanel server. Installs the uploaded zips in $1, test-starts
# them on spare ports, then swaps them in. The replaced versions are kept as
# app.prev / node_modules.prev so rollback-remote.sh can restore them.
set -euo pipefail
STAGE="$1"
NODE_BIN=/opt/alt/alt-nodejs22/root/usr/bin
NODE="$NODE_BIN/node"
cd "$STAGE"

echo "== Unpacking"
for app in api web; do
  mkdir -p "$app"
  (cd "$app" && unzip -qo "../turboxglobal-$app.zip")
  find "$app" -type d -exec chmod 755 {} +
  find "$app" -type f -exec chmod 644 {} +
done

echo "== argon2 (password hashing) for this server's glibc"
live=~/turboxglobal-api/node_modules/argon2
new=api/node_modules/argon2
if [ -d "$live/build" ] && [ "$(grep '"version"' "$live/package.json")" = "$(grep '"version"' "$new/package.json")" ]; then
  cp -a "$live/build" "$new/build"
  echo "reused the compiled binary from the live API"
else
  (cd "$new" && PATH="$NODE_BIN:$PATH" npx --yes node-gyp@11 rebuild --python=/opt/alt/python313/bin/python3.13 >/dev/null)
  echo "compiled argon2 from source"
fi
(cd api/app && "$NODE" -e 'require("argon2").hash("x").then(() => console.log("argon2 ok"))')

echo "== Test start on spare ports"
(cd api/app && NODE_ENV=production PORT=4390 DATABASE_URL=postgresql://x:y@127.0.0.1:1/x \
  DATABASE_DRIVER=neon-websocket CORS_ORIGINS=https://turboxglobal.com \
  PUBLIC_WEB_URL=https://turboxglobal.com timeout 25 "$NODE" dist/main.js > "$STAGE/api-boot.log" 2>&1 &)
(cd web/app && NODE_ENV=production PORT=3390 HOSTNAME=127.0.0.1 timeout 25 "$NODE" server.js > "$STAGE/web-boot.log" 2>&1 &)
ok=0
for _ in $(seq 1 20); do
  sleep 1
  if grep -q "successfully started" "$STAGE/api-boot.log" &&
     [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3390/)" = 200 ]; then ok=1; break; fi
done
if [ "$ok" != 1 ]; then
  echo "Test start FAILED. Live site untouched."
  tail -20 "$STAGE/api-boot.log" "$STAGE/web-boot.log"
  exit 1
fi
echo "both apps started"

echo "== Swap in"
for app in api web; do
  cd ~/turboxglobal-$app
  rm -rf app.prev node_modules.prev
  mv app app.prev
  mv node_modules node_modules.prev
  mv "$STAGE/$app/app" app
  mv "$STAGE/$app/node_modules" node_modules
  mkdir -p app/tmp && touch app/tmp/restart.txt
done
rm -rf "$STAGE"
echo "deployed; previous version kept as app.prev"
