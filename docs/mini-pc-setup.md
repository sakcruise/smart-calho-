# Setting up the wall screen (mini PC + 27" touch monitor)

The goal: the mini PC switches itself on, signs in, and opens the family calendar full-screen, with no keyboard needed, even after a power cut. These steps assume Windows 11, which most Amazon mini PCs ship with. Allow about 30 minutes.

## 1. Connect the monitor

1. Connect the monitor to the mini PC with HDMI or USB-C for the picture.
2. **Also connect the monitor's USB touch cable** (usually USB-B or USB-C on the monitor to a USB-A port on the PC). Without it the screen shows the picture but doesn't respond to touch.
3. In **Settings → System → Display**, set the resolution to **1920 × 1080** and **Scale to 100%**. The app is designed for that size at a 2–3 metre viewing distance.
4. If touches land in the wrong place: **Control Panel → Tablet PC Settings → Setup → Touch input**, then tap the screen it asks for.

## 2. Make it start by itself after a power cut

1. Restart the PC and open the BIOS/UEFI setup (usually by pressing **Delete** or **F2** as it starts).
2. Find **"Restore on AC power loss"** (sometimes called "AC Power Recovery" or "Power On After Power Failure") and set it to **Power On**.
3. Save and exit.

## 3. Sign in to Windows automatically

1. Create a local Windows account just for the wall, for example `family-wall`, with a password.
2. Press **Win + R**, type `netplwiz` and press Enter.
3. If the box "Users must enter a user name and password" is missing, first go to **Settings → Accounts → Sign-in options** and turn off "For improved security, only allow Windows Hello sign-in".
4. Untick "Users must enter a user name and password", click OK, and type the wall account's password twice.

## 4. Never sleep

1. **Settings → System → Power**: set "Turn off my screen after" and "Make my device sleep after" to **Never**, for both battery and plugged in.
2. **Settings → Personalisation → Lock screen → Screen saver**: set to **None**.
3. **Settings → Windows Update → Advanced options → Active hours**: set to something like 06:00–23:00 so updates restart the PC overnight. The calendar comes straight back afterwards.

The app goes to its dim night clock itself between the night-mode hours you set in **Parents → Wall screen**.

## 5. Open the calendar full-screen at start-up

1. Install **Google Chrome**.
2. Open Chrome, go to your Vercel address (for example `https://smart-calho-xxxx.vercel.app`) and **sign in once** with the parent account. It stays signed in.
3. Right-click the desktop → **New → Shortcut**, and paste this as the location (change the address to yours):

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --overscroll-history-navigation=0 --autoplay-policy=no-user-gesture-required https://smart-calho-xxxx.vercel.app
   ```

4. Name it **Family Calendar**.
5. Press **Win + R**, type `shell:startup`, press Enter, and move the shortcut into the folder that opens.
6. Restart the PC. It should come up straight into the calendar, full-screen.

`--autoplay-policy=no-user-gesture-required` lets the reminder chime and the celebration sounds play without anyone touching the screen first.

To get out of kiosk mode for maintenance, press **Alt + F4** with a keyboard plugged in.

## 6. What the app does by itself

- Keeps the screen awake while it's open.
- After 2 minutes untouched (you can change this), goes back to Home and shows your family photos; at night it shows a dim clock only.
- Re-locks the Parents area whenever it goes idle.
- Restarts itself if anything crashes, and reloads at about 03:30 each night to start the day fresh.
- Picks up new versions automatically when they're pushed to GitHub.
- Reports in every 5 minutes. **Parents → System health** shows "Wall screen · seen 2 min ago", and turns red if it hasn't been seen for 15 minutes.
- Keeps showing the last information it had if the Wi-Fi drops, and says so on screen.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Screen shows the picture but touches do nothing | The monitor's USB touch cable isn't connected (step 1.2). |
| Comes up on the Windows login screen | Auto sign-in isn't set (step 3). |
| Doesn't switch on after a power cut | The BIOS power setting isn't on (step 2). |
| No sound for reminders | Check Windows volume and that the monitor's speakers or the PC's output are selected; the shortcut flag in step 5 must be present. |
| Asks to sign in again | Sign in once inside the kiosk window (plug in a keyboard), then it remembers. |
