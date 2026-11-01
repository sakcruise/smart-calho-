#!/usr/bin/env bash
# Home Box installer for Family Smart Calendar (Mac and Linux).
#   curl -fsSL https://smart-calho.vercel.app/home-box/install.sh | bash
# Needs Docker (Docker Desktop on a Mac). Installs into ~/home-box. Safe to run again to update.
set -euo pipefail
BASE="${HOME_BOX_BASE:-https://smart-calho.vercel.app/home-box}"
DIR="${HOME_BOX_DIR:-$HOME/home-box}"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  say "Docker isn't installed yet."
  echo "Install Docker Desktop from https://www.docker.com/products/docker-desktop/ , open it once, then run this again."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  say "Docker is installed but not running. Open Docker Desktop, wait for it to say 'running', then run this again."
  exit 1
fi

say "Downloading the Home Box into $DIR"
mkdir -p "$DIR/config/packages" "$DIR/setup" "$DIR/data"
fetch() { curl -fsSL "$BASE/$1" -o "$DIR/$1"; }
fetch docker-compose.yml
fetch config/configuration.yaml
fetch config/packages/family_calendar.yaml
fetch setup/setup.py
[ -f "$DIR/config/secrets.yaml" ] || fetch config/secrets.yaml

CODE="${PAIR_CODE:-}"
if ! grep -q "fam_" "$DIR/config/secrets.yaml" 2>/dev/null && [ -z "$CODE" ]; then
  say "Pair with your family"
  echo "In the Family Calendar app: Parents → Home Box → Pair a Home Box. Type the code shown (like ABCD-1234):"
  read -r CODE < /dev/tty || CODE=""
fi

cd "$DIR"
say "Starting Home Assistant and the voice engines (the first time downloads about 2 GB, so it can take a while)…"
docker compose pull
docker compose up -d homeassistant whisper piper openwakeword
PAIR_CODE="$CODE" docker compose run --rm -T setup

say "All set!"
(command -v say >/dev/null 2>&1 && say "Your Home Box is ready" &) 2>/dev/null || true
echo "• Try it: open http://localhost:8123 , log in with the details below, tap the speech bubble (Assist) and the mic."
echo "• Say: \"what's on tomorrow?\" or \"add milk to the shopping list\""
[ -f "$DIR/config/home-box-login.txt" ] && sed -n '3,4p' "$DIR/config/home-box-login.txt"
echo "• Stop it: cd $DIR && docker compose down     Start again: cd $DIR && docker compose up -d"
