# Voice and Home Assistant on the wall mini PC

> **Easiest: the Home Box.** Install Docker Desktop, then in the app open Parents → Voice → Home Box, tap
> **Pair a Home Box**, and paste the one-line command shown into Terminal (Mac/Linux) or PowerShell (Windows).
> It installs Home Assistant with Whisper, Piper and openWakeWord, creates the login, connects the voice
> engines and pairs with your family automatically. Files: `public/home-box/`.
> The manual steps below are for people who already run Home Assistant or want a VirtualBox install.

Everything here runs on the mini PC behind the wall screen. Speech never leaves the house; only the
recognised sentence ("add milk to the shopping list") is sent to the family calendar.

```
USB speakerphone ──► Home Assistant (virtual machine on the mini PC)
                      ├─ openWakeWord   hears "Hey Jarvis"
                      ├─ Whisper        speech → text
                      ├─ family_calendar.yaml  sentence → our voice API → reply
                      └─ Piper          reply → speech
                     ▲
Wall screen (Chrome kiosk) ◄── the reply also pops up on the wall
```

Time: about an hour, on the mini PC itself (keyboard and mouse). Needs 8 GB RAM or more.

## 1. Install Home Assistant in VirtualBox (Windows mini PC)

VirtualBox can hand a USB device to Home Assistant; Hyper-V can't, so use VirtualBox.

1. Install **VirtualBox** and its **Extension Pack** (both from virtualbox.org).
2. Download the Home Assistant OS **VirtualBox (.vdi)** image from home-assistant.io → Installation → Windows. Unzip it.
3. VirtualBox → New: name *Home Assistant*, type *Linux*, version *Other Linux (64-bit)*.
   - Memory **3 GB** (4 GB if you have 16 GB), CPUs **2**.
   - Use the downloaded `.vdi` as the hard disk.
   - Settings → System → tick **Enable EFI**.
   - Settings → Network → Adapter 1 → **Bridged Adapter** (so phones can reach it).
   - Settings → Audio → untick **Enable audio** (the speakerphone is passed through instead).
4. Start it. After a few minutes open `http://homeassistant.local:8123` in a browser on any computer and create the owner account.
5. Start the VM with Windows: put a shortcut to
   `"C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm "Home Assistant" --type headless`
   in `shell:startup`, alongside the kiosk browser shortcut.

(Linux mini PC instead? Install Home Assistant OS in KVM/virt-manager the same way, or run Home Assistant
Container in Docker with the Wyoming containers.)

## 2. Give it the speakerphone

1. Plug the USB speakerphone into the mini PC.
2. VirtualBox → Home Assistant → Settings → USB → **USB 3.0 controller**, then **+** and pick the speakerphone.
   It now belongs to Home Assistant (Windows won't use it any more; wall chimes still play through the monitor).
3. Restart the VM.

## 3. The voice add-ons

Settings → Add-ons → Add-on store, install and start each (tick *Start on boot*):

| Add-on | What it does | Setting to change |
|---|---|---|
| **openWakeWord** | listens for the wake word | none |
| **Whisper** | speech → text | model `small-int8` (or `base-int8` if replies feel slow), language `en` |
| **Piper** | text → speech | voice `en_GB-alba-medium` or `en_GB-northern_english_male-medium` |
| **Assist Microphone** | uses the USB speakerphone as a voice satellite | pick the speakerphone as input and output |
| **File editor** | to paste our setup | none |

Settings → Devices & services: each add-on appears as *Discovered* → **Configure**.

Settings → Voice assistants → Add assistant:
- Conversation agent: **Home Assistant**
- Speech-to-text: **faster-whisper**, Text-to-speech: **piper**
- Wake word: **openWakeWord**, choose **hey_jarvis** (other built-ins: *ok_nabu*, *hey_mycroft*, *alexa*)

Then open the Assist Microphone device and set its pipeline to this assistant.

Test: say "Hey Jarvis… what time is it?"

## 4. Connect it to the family calendar

1. On the wall: Parents → Voice → **Make a voice key**, copy it.
2. File editor → `secrets.yaml`, add:
   ```yaml
   family_voice_token: fam_paste_your_key_here
   ```
3. File editor → `configuration.yaml`, make sure it has:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
4. Create the folder `packages`, then a file `packages/family_calendar.yaml`, and paste in **Copy Home Assistant setup**
   from Parents → Voice (the same file is `public/home-box/config/packages/family_calendar.yaml` in this repo).
5. Developer tools → YAML → **Check configuration**, then **Restart**.

## 5. Try it

| Say | What happens |
|---|---|
| "Hey Jarvis, add milk and eggs to the shopping list" | added under Dairy & eggs |
| "Hey Jarvis, what's on the shopping list?" | reads it out |
| "Hey Jarvis, what's on tomorrow?" / "what's Ava doing on Saturday?" | reads the calendar |
| "Hey Jarvis, remind me at 5 pm to call Granny" | reminder on the wall and phones |
| "Hey Jarvis, Ava brushed her teeth" | ticks it, stars go in the jar (or asks a parent if it needs approval) |
| "Hey Jarvis, how many stars does Arjun have?" | stars and how many to the next reward |

Every answer also pops up on the wall for 12 seconds, and Parents → Voice shows the last few things it heard.

## Privacy

- Wake word, speech-to-text and the voice all run on the mini PC. No audio is stored.
- The voice key only lets Home Assistant use these voice commands for your family. Remove it in Parents → Voice to cut it off.
- Press the speakerphone's mute button when you want it to stop listening.

## Cameras (next sprint)

The Eufy doorbell and cameras connect through the community **eufy_security** integration (installed via HACS)
with the **eufy-security-ws** add-on. The Nooie baby cam has no Home Assistant support; a community proxy may work.
