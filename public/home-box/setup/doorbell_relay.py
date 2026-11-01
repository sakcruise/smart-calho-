"""Doorbell relay: listens to the Eufy bridge and turns a doorbell press into a Home Assistant event.

The eufy_sdk integration doesn't expose presses for some doorbells, but the bridge broadcasts them
({"event": "doorbellPress", "deviceSn": "..."}). We fire `family_doorbell_press` in Home Assistant,
where the Family Calendar automation pops it up on the wall and notifies phones.
"""
import asyncio
import json
import os
import urllib.request

import websockets

HA = os.environ.get("HA_URL", "http://homeassistant:8123").rstrip("/")
WS = os.environ.get("EUFY_WS", "ws://eufy:3000/ws")
TOKEN_FILE = os.path.join(os.environ.get("CONFIG_DIR", "/config"), ".home_box_token")
PRESS_EVENTS = {"doorbellPress", "doorbellRing", "ring", "rings"}


def log(msg: str) -> None:
    print(f"[doorbell-relay] {msg}", flush=True)


def fire(sn: str) -> None:
    token = open(TOKEN_FILE).read().strip()
    req = urllib.request.Request(f"{HA}/api/events/family_doorbell_press", data=json.dumps({"sn": sn}).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        log(f"doorbell press from {sn} → Home Assistant ({r.status})")


async def main() -> None:
    while True:
        try:
            async with websockets.connect(WS, max_size=None, ping_interval=30) as ws:
                log(f"listening to {WS}")
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    if isinstance(msg, dict) and msg.get("event") in PRESS_EVENTS:
                        sn = str(msg.get("deviceSn") or msg.get("serialNumber") or msg.get("sn") or "")
                        try:
                            fire(sn)
                        except Exception as e:
                            log(f"couldn't tell Home Assistant: {e}")
        except Exception as e:
            log(f"bridge not reachable ({e}); retrying in 10 s")
        await asyncio.sleep(10)


if __name__ == "__main__":
    asyncio.run(main())
