import type { CalendarEvent } from '../../lib/types'

/** One drawn occurrence of an event (recurring local events produce several). */
export interface Occurrence {
  key: string
  event: CalendarEvent
  start: Date
  end: Date
  allDay: boolean
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
/** Weeks start on Monday (UK). */
export const startOfWeek = (d: Date) => { const s = startOfDay(d); return addDays(s, -((s.getDay() + 6) % 7)) }
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

/** All-day events are stored as UTC midnight dates; read them back as local calendar dates. */
function asLocal(iso: string, allDay: boolean): Date {
  const d = new Date(iso)
  return allDay ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : d
}

/** Expand events into occurrences overlapping [from, to). Local events may repeat; synced ones arrive pre-expanded. */
export function occurrences(events: CalendarEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of events) {
    const s0 = asLocal(ev.starts_at, ev.all_day)
    const e0 = asLocal(ev.ends_at, ev.all_day)
    const len = Math.max(0, e0.getTime() - s0.getTime())
    const push = (s: Date) => {
      const e = new Date(s.getTime() + len)
      const endForOverlap = ev.all_day ? e : (len === 0 ? new Date(s.getTime() + 1) : e)
      if (endForOverlap > from && s < to) out.push({ key: `${ev.id}:${s.getTime()}`, event: ev, start: s, end: e, allDay: ev.all_day })
    }
    if (ev.source === 'local' && ev.recurrence_rule) {
      const s = new Date(s0)
      let guard = 0
      while (s < to && guard++ < 2000) {
        push(new Date(s))
        if (ev.recurrence_rule === 'daily') s.setDate(s.getDate() + 1)
        else if (ev.recurrence_rule === 'weekly') s.setDate(s.getDate() + 7)
        else if (ev.recurrence_rule === 'monthly') s.setMonth(s.getMonth() + 1)
        else s.setFullYear(s.getFullYear() + 1)
      }
    } else push(s0)
  }
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
}

/** Occurrences that fall on a given day (all-day events cover [start, end) dates). */
export function onDay(occ: Occurrence[], day: Date): Occurrence[] {
  const s = startOfDay(day), e = addDays(s, 1)
  return occ.filter((o) => o.allDay ? (o.start < e && (o.end > s || sameDay(o.start, s))) : (o.start < e && o.end > s) || sameDay(o.start, s))
}

export const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
