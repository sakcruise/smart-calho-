"""Home Box first-run setup. Safe to run again: every step checks what is already done.

1. Finish Home Assistant's welcome steps (owner login saved to config/home-box-login.txt)
2. Connect the local voice engines (Whisper, Piper, openWakeWord)
3. Make a "Family voice" assistant and set it as the default
4. Pair with the family calendar using PAIR_CODE, then reload the voice commands
"""
import asyncio
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.request

import websockets

HA = os.environ.get("HA_URL", "http://homeassistant:8123").rstrip("/")
CONFIG = os.environ.get("CONFIG_DIR", "/config")
PAIR_CODE = os.environ.get("PAIR_CODE", "").strip()
PAIR_URL = os.environ.get("PAIR_URL", "https://kmuryknypcnhludyjaoi.supabase.co/functions/v1/pair-home-box")
TZ = os.environ.get("TZ", "Europe/London")
CLIENT_ID = f"{HA}/"
TOKEN_FILE = os.path.join(CONFIG, ".home_box_token")
LOGIN_FILE = os.path.join(CONFIG, "home-box-login.txt")
SECRETS_FILE = os.path.join(CONFIG, "secrets.yaml")
ENGINES = [("whisper", 10300), ("piper", 10200), ("openwakeword", 10400)]
ENGINE_HOSTS = {h: os.environ.get(f"{h.upper()}_HOST", h) for h, _ in ENGINES}


def say(msg: str) -> None:
    print(f"[home-box] {msg}", flush=True)


def http(method: str, path: str, body=None, token: str | None = None, form: bool = False, url: str | None = None):
    data = None
    headers = {}
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url or f"{HA}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode(errors="replace")


def wait_for_home_assistant() -> None:
    say("Waiting for Home Assistant to start (first start can take a few minutes)…")
    for _ in range(600):
        try:
            status, _ = http("GET", "/api/onboarding")
            if status in (200, 401, 404):
                return
        except Exception:
            pass
        time.sleep(2)
    sys.exit("Home Assistant didn't start. Check: docker compose logs homeassistant")


def onboard() -> str | None:
    """Create the owner login on a brand-new Home Assistant. Returns a short-lived access token, or None if already done."""
    status, steps = http("GET", "/api/onboarding")
    if status != 200 or not isinstance(steps, list):
        return None
    done = {s["step"] for s in steps if s.get("done")}
    if "user" in done:
        return None
    password = secrets.token_urlsafe(12)
    status, res = http("POST", "/api/onboarding/users", {
        "client_id": CLIENT_ID, "name": "Family", "username": "family", "password": password, "language": "en",
    })
    if status != 200:
        sys.exit(f"Couldn't create the Home Assistant login: {res}")
    with open(LOGIN_FILE, "w") as f:
        f.write("Home Box (Home Assistant) login\n")
        f.write("Open http://localhost:8123 on this computer\n")
        f.write(f"Username: family\nPassword: {password}\n")
    os.chmod(LOGIN_FILE, 0o600)
    status, tok = http("POST", "/auth/token", {"grant_type": "authorization_code", "code": res["auth_code"], "client_id": CLIENT_ID}, form=True)
    if status != 200:
        sys.exit(f"Couldn't log in to Home Assistant: {tok}")
    access = tok["access_token"]
    http("POST", "/api/onboarding/core_config", {}, token=access)
    http("POST", "/api/onboarding/analytics", {}, token=access)
    http("POST", "/api/onboarding/integration", {"client_id": CLIENT_ID, "redirect_uri": f"{HA}/?auth_callback=1"}, token=access)
    say("Created the Home Assistant login (saved in config/home-box-login.txt).")
    return access


class WS:
    def __init__(self, conn):
        self.conn, self.n = conn, 0

    async def call(self, msg: dict):
        self.n += 1
        await self.conn.send(json.dumps({"id": self.n, **msg}))
        while True:
            res = json.loads(await self.conn.recv())
            if res.get("id") == self.n and res.get("type") == "result":
                if not res.get("success"):
                    raise RuntimeError(f"{msg['type']}: {res.get('error')}")
                return res.get("result")


async def connect(token: str) -> WS:
    conn = await websockets.connect(HA.replace("http", "ws", 1) + "/api/websocket", max_size=None)
    await conn.recv()  # auth_required
    await conn.send(json.dumps({"type": "auth", "access_token": token}))
    if json.loads(await conn.recv()).get("type") != "auth_ok":
        raise RuntimeError("auth failed")
    return WS(conn)


async def get_long_lived_token(short: str | None) -> str:
    if os.path.exists(TOKEN_FILE):
        token = open(TOKEN_FILE).read().strip()
        if http("GET", "/api/", token=token)[0] == 200:
            return token
    if not short:
        sys.exit("Home Assistant was already set up by hand, so the Home Box can't log in. "
                 "Delete the config/.storage folder to start fresh, or follow docs/voice-setup.md.")
    ws = await connect(short)
    token = await ws.call({"type": "auth/long_lived_access_token", "client_name": "Home Box setup", "lifespan": 3650})
    await ws.conn.close()
    with open(TOKEN_FILE, "w") as f:
        f.write(token)
    os.chmod(TOKEN_FILE, 0o600)
    return token


async def set_location(ws: WS) -> None:
    try:
        await ws.call({"type": "config/core/update", "time_zone": TZ, "unit_system": "metric", "country": "GB", "currency": "GBP", "language": "en-GB"})
    except Exception as e:  # older/newer versions may refuse some fields
        say(f"(skipped some regional settings: {e})")


def add_engines(token: str) -> None:
    _, entries = http("GET", "/api/config/config_entries/entry?domain=wyoming", token=token)
    have = {e.get("title", "").lower() for e in (entries or [])}
    _, all_entries = http("GET", "/api/config/config_entries/entry", token=token)
    have_hosts = {json.dumps(e).lower() for e in (all_entries or []) if e.get("domain") == "wyoming"}
    for name, port in ENGINES:
        host = ENGINE_HOSTS[name]
        if any(name in t for t in have) or any(f'"{host}"' in h for h in have_hosts):
            continue
        for attempt in range(60):  # the engine may still be downloading its model
            status, flow = http("POST", "/api/config/config_entries/flow", {"handler": "wyoming", "show_advanced_options": False}, token=token)
            if status != 200:
                sys.exit(f"Couldn't start connecting {name}: {flow}")
            status, res = http("POST", f"/api/config/config_entries/flow/{flow['flow_id']}", {"host": host, "port": port}, token=token)
            if status == 200 and res.get("type") == "create_entry":
                say(f"Connected {name}.")
                break
            if status == 200 and res.get("type") == "abort" and res.get("reason") == "already_configured":
                break
            http("DELETE", f"/api/config/config_entries/flow/{flow['flow_id']}", token=token)
            if attempt == 0:
                say(f"Waiting for {name} to be ready (it downloads a voice model the first time)…")
            time.sleep(10)
        else:
            say(f"Couldn't connect {name}. Run setup again later: docker compose run --rm setup")


async def make_pipeline(ws: WS) -> str:
    states = await ws.call({"type": "get_states"})
    ids = [s["entity_id"] for s in states]
    stt = next((i for i in ids if i.startswith("stt.")), None)
    tts = next((i for i in ids if i.startswith("tts.") and "piper" in i), None) or next((i for i in ids if i.startswith("tts.")), None)
    wake = next((i for i in ids if i.startswith("wake_word.")), None)
    listing = await ws.call({"type": "assist_pipeline/pipeline/list"})
    existing = next((p for p in listing["pipelines"] if p["name"] == "Family voice"), None)
    voice = os.environ.get("PIPER_VOICE", "en_GB-alba-medium")
    data = {
        "name": "Family voice", "language": "en", "conversation_engine": "conversation.home_assistant", "conversation_language": "en",
        "stt_engine": stt, "stt_language": "en" if stt else None,
        "tts_engine": tts, "tts_language": "en_GB" if tts else None, "tts_voice": voice if tts else None,
        "wake_word_entity": wake, "wake_word_id": "ok_nabu" if wake else None,
        "prefer_local_intents": False,
    }
    if existing:
        await ws.call({"type": "assist_pipeline/pipeline/update", "pipeline_id": existing["id"], **data})
        pid = existing["id"]
    else:
        pid = (await ws.call({"type": "assist_pipeline/pipeline/create", **data}))["id"]
    await ws.call({"type": "assist_pipeline/pipeline/set_preferred", "pipeline_id": pid})
    summary = f"speech {stt or 'missing'}, voice {tts or 'missing'}, wake word {wake or 'missing'}"
    say(f"Voice assistant ready: {summary}.")
    return summary


def paired() -> bool:
    try:
        return "fam_" in open(SECRETS_FILE).read()
    except FileNotFoundError:
        return False


def voice_key() -> str | None:
    try:
        for line in open(SECRETS_FILE):
            if line.startswith("family_voice_token:") and "fam_" in line:
                return line.split(":", 1)[1].strip()
    except FileNotFoundError:
        pass
    return None


def check_and_report(token: str, engines: str) -> None:
    """Ask Home Assistant a real question end to end, then tell the family app the box is ready."""
    key = voice_key()
    if not key:
        return
    answer, ok = "", False
    for _ in range(12):  # the voice commands may still be reloading
        status, res = http("POST", "/api/conversation/process", {"text": "what's on today", "language": "en"}, token=token)
        try:
            answer = res["response"]["speech"]["plain"]["speech"]
        except Exception:
            answer = ""
        if status == 200 and answer and "couldn't reach" not in answer.lower() and "not connected" not in answer.lower():
            ok = True
            break
        time.sleep(5)
    if ok:
        say(f"Test question answered: {answer}")
    else:
        say(f"Test question didn't get through yet ({answer or 'no answer'}).")
    detail = engines if ok else f"the test question didn't reach the calendar ({answer or 'no answer'})"
    http("POST", "", {"token": key, "ready": True, "ok": ok and "missing" not in engines, "detail": detail if "missing" in engines or not ok else ""}, url=PAIR_URL)


def pair(token: str) -> None:
    if paired():
        say("Already paired with your family calendar.")
        return
    if not PAIR_CODE:
        say("Not paired yet. In the app: Parents → Home Box → Pair, then run: PAIR_CODE=ABCD-1234 docker compose run --rm setup")
        return
    status, res = http("POST", "", {"code": PAIR_CODE, "name": "Home Box"}, url=PAIR_URL)
    if status != 200 or not isinstance(res, dict) or "token" not in res:
        msg = res.get("error") if isinstance(res, dict) else res
        say(f"Pairing didn't work: {msg}")
        return
    lines = []
    if os.path.exists(SECRETS_FILE):
        lines = [l for l in open(SECRETS_FILE).read().splitlines() if not l.startswith("family_voice_token:")]
    lines.append(f"family_voice_token: {res['token']}")
    with open(SECRETS_FILE, "w") as f:
        f.write("\n".join(lines) + "\n")
    os.chmod(SECRETS_FILE, 0o600)
    say(f"Paired with {res.get('family', 'your family')}.")
    # Pick up the new key: reload the voice commands (restart if this version can't reload them)
    for svc in ("rest_command/reload", "automation/reload"):
        status, _ = http("POST", f"/api/services/{svc}", {}, token=token)
        if status != 200:
            http("POST", "/api/services/homeassistant/restart", {}, token=token)
            say("Restarting Home Assistant to load the voice commands…")
            break


async def main() -> None:
    wait_for_home_assistant()
    short = onboard()
    token = await get_long_lived_token(short)
    ws = await connect(token)
    if short:
        await set_location(ws)
    add_engines(token)
    await asyncio.sleep(3)  # let the new engines register
    engines = await make_pipeline(ws)
    await ws.conn.close()
    pair(token)
    check_and_report(token, engines)
    say("Done. Open http://localhost:8123 and tap the Assist (speech bubble) button to try: \"what's on tomorrow?\"")


if __name__ == "__main__":
    import urllib.parse  # noqa: E402  (used by http form posts)
    asyncio.run(main())
