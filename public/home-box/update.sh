#!/usr/bin/env bash
# Update the Home Box to the latest voice and doorbell commands (Mac and Linux).
#   curl -fsSL https://smart-calho.vercel.app/home-box/update.sh | bash
set -euo pipefail
BASE="${HOME_BOX_BASE:-https://smart-calho.vercel.app/home-box}"
DIR="${HOME_BOX_DIR:-$HOME/home-box}"
[ -f "$DIR/docker-compose.yml" ] || { echo "No Home Box found in $DIR. Set it up from Parents → Voice first."; exit 1; }
for f in docker-compose.yml config/configuration.yaml config/packages/family_calendar.yaml setup/setup.py; do
  curl -fsSL "$BASE/$f" -o "$DIR/$f"
done
cd "$DIR"
docker compose up -d
docker compose run --rm -T setup
printf '\n\033[1mHome Box updated.\033[0m\n'
