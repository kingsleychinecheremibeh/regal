#!/usr/bin/env bash
# Runs ON the cPanel server. Puts back the version kept by deploy-remote.sh.
set -euo pipefail
stamp=$(date +%Y%m%d-%H%M%S)
for app in api web; do
  cd ~/turboxglobal-$app
  if [ ! -d app.prev ] || [ ! -d node_modules.prev ]; then
    echo "No previous version of $app to restore."
    exit 1
  fi
done
for app in api web; do
  cd ~/turboxglobal-$app
  mv app "app.rolled-back-$stamp"
  mv node_modules "node_modules.rolled-back-$stamp"
  mv app.prev app
  mv node_modules.prev node_modules
  mkdir -p app/tmp && touch app/tmp/restart.txt
  # Keep only the newest rolled-back copy to save disk space.
  ls -d app.rolled-back-* 2>/dev/null | sort | head -n -1 | xargs -r rm -rf
  ls -d node_modules.rolled-back-* 2>/dev/null | sort | head -n -1 | xargs -r rm -rf
done
echo "rolled back to the previous version"
