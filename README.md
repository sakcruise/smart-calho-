# Family Smart Calendar

A wall-mounted family hub: the week's schedule for everyone, a task board where kids and parents tick off routines and earn stars toward surprise gifts, shared grocery lists and reminders, the clock, date and weather, and rolling family photos when idle. Voice control of the smart home comes in Part 2.

## Hardware

- 27" monitor on the kitchen wall, driven by a mini PC running Chromium in kiosk mode.
- Parents also open the same app on their phones in admin mode.

## Stack

- React + Vite + TypeScript, Tailwind, installable PWA (`vite-plugin-pwa`)
- Supabase: Postgres, Realtime, Auth, Storage
- FastAPI integration service (calendar sync, weather, reminder scheduler) — separate folder, added in Sprint 2
- Frontend on Vercel; integration service on the mini PC or Azure

## Getting started

```bash
npm install
cp .env.example .env.local   # add the Supabase URL and anon key
npm run dev
```

## Layout

```
src/
  features/
    dashboard/   clock, date, weather, photo slideshow
    calendar/    week, day, month views and sync
    tasks/       task board, routines, approvals
    rewards/     stars, reward goals, surprise gifts, streaks
    lists/       grocery and other lists
    reminders/   reminders and the on-screen chime
    admin/       family members, PIN, settings
  lib/           supabase client and shared helpers
  components/    shared UI
```

## Sprints

0. Foundation — repo, app shell, Supabase project, PIN and avatars, kiosk on the wall
1. Dashboard — clock, date, weather, photo slideshow
2. Lists and reminders
3. Task board and routines
4. Stars, rewards and surprises
5. Family calendar with Google / Microsoft 365 sync
6. Hardening — offline, push, backup, kiosk watchdog
