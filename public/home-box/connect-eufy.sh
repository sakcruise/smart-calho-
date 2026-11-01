#!/usr/bin/env bash
# Connect Eufy doorbell and cameras to your Home Box (Mac and Linux).
#   curl -fsSL https://smart-calho.vercel.app/home-box/connect-eufy.sh | bash
# Use a SECOND Eufy account that your main account has shared the devices with (admin rights),
# otherwise Eufy keeps logging your phone out. Your Eufy password stays on this computer.
set -euo pipefail
BASE="${HOME_BOX_BASE:-https://smart-calho.vercel.app/home-box}"
DIR="${HOME_BOX_DIR:-$HOME/home-box}"
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

[ -f "$DIR/docker-compose.yml" ] || { say "Set up the Home Box first (Parents → Voice in the app)."; exit 1; }
docker info >/dev/null 2>&1 || { say "Open Docker Desktop first, then run this again."; exit 1; }

say "Updating the Home Box files"
curl -fsSL "$BASE/docker-compose.yml" -o "$DIR/docker-compose.yml"
curl -fsSL "$BASE/setup/setup.py" -o "$DIR/setup/setup.py"

if [ ! -f "$DIR/eufy.env" ]; then
  say "Your second Eufy account (the one your main account shares the doorbell and cameras with)"
  printf "Email: "; read -r EMAIL < /dev/tty
  printf "Password (hidden): "; stty -echo < /dev/tty; read -r PASS < /dev/tty; stty echo < /dev/tty; echo
  printf "Country code [GB]: "; read -r COUNTRY < /dev/tty; COUNTRY="${COUNTRY:-GB}"
  umask 077
  printf 'EUFY_EMAIL=%s\nEUFY_PASSWORD=%s\nEUFY_COUNTRY=%s\n' "$EMAIL" "$PASS" "$COUNTRY" > "$DIR/eufy.env"
fi
grep -q '^COMPOSE_PROFILES=' "$DIR/.env" 2>/dev/null || echo 'COMPOSE_PROFILES=eufy' >> "$DIR/.env"

cd "$DIR"
say "Starting the Eufy bridge…"
docker compose pull eufy
docker compose up -d --force-recreate eufy

# Watch the bridge log in to Eufy (about a minute) so a wrong password is reported straight away
for i in $(seq 1 30); do
  LOG="$(docker compose logs --since 3m eufy 2>/dev/null || true)"
  if echo "$LOG" | grep -q "password incorrect\|login attempt failed"; then
    say "Eufy said the email or password is wrong."
    echo "Check you can log in to the Eufy app with that SECOND account, and that the country is where it was created."
    rm -f "$DIR/eufy.env"
    echo "Then run this again; it will ask for the details again."
    exit 1
  fi
  echo "$LOG" | grep -qi "logged in\|connected to eufy\|auth required: \(2fa\|captcha\|twofa\)\|devices" && break
  sleep 2
done

EUFY_SETUP=1 docker compose run --rm -T setup || true
RESULT="$(cat "$DIR/config/.home_box_eufy_result" 2>/dev/null || echo ui)"

if [ "$RESULT" = "code" ]; then
  printf "\nType the code Eufy just sent to the second account: "; read -r CODE < /dev/tty
  EUFY_SETUP=1 EUFY_CODE="$CODE" docker compose run --rm -T setup || true
  RESULT="$(cat "$DIR/config/.home_box_eufy_result" 2>/dev/null || echo ui)"
fi

if [ "$RESULT" = "done" ]; then
  say "Eufy is connected!"
  ([ -x /usr/bin/say ] && /usr/bin/say "Eufy is connected" &) 2>/dev/null || true
  echo "Open http://localhost:8123 → Settings → Devices & services → Eufy SDK to see the doorbell and cameras."
else
  say "Almost there — see the message above."
  echo "Wrong email or password? Delete $DIR/eufy.env and run this again."
fi
