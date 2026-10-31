import { isMuted } from '../../lib/sound'
import type { Recurrence, Reminder } from '../../lib/types'

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Once', daily: 'Every day', weekdays: 'Weekdays', weekly: 'Every week', monthly: 'Every month',
}

/** When the reminder should next fire, taking a snooze into account. */
export function fireAt(r: Reminder): Date {
  return new Date(r.snoozed_until && r.snoozed_until > r.due_at ? r.snoozed_until : r.due_at)
}

export function isDue(r: Reminder, now = new Date()): boolean {
  return !r.dismissed_at && fireAt(r) <= now
}

/** Next occurrence after `from` for a recurring reminder, keeping the original clock time. */
export function nextOccurrence(dueAt: string, rule: Recurrence, from = new Date()): Date | null {
  if (rule === 'none') return null
  const d = new Date(dueAt)
  const step = () => {
    if (rule === 'daily') d.setDate(d.getDate() + 1)
    else if (rule === 'weekly') d.setDate(d.getDate() + 7)
    else if (rule === 'monthly') d.setMonth(d.getMonth() + 1)
    else if (rule === 'weekdays') { do { d.setDate(d.getDate() + 1) } while (d.getDay() === 0 || d.getDay() === 6) }
  }
  let guard = 0
  while (d <= from && guard++ < 1000) step()
  return d
}

export function formatDue(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (sameDay) return `Today · ${time}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${time}`
}

/** A short two-note chime from the Web Audio API; no asset needed. */
export function chime() {
  if (isMuted()) return
  try {
    const ctx = new AudioContext()
    const play = (freq: number, at: number) => {
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.6)
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.65)
    }
    play(880, ctx.currentTime); play(1174.7, ctx.currentTime + 0.25)
  } catch { /* audio blocked until the screen is tapped; the banner still shows */ }
}
