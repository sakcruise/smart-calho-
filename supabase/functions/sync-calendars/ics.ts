// Pure ICS → occurrences expansion, shared by the edge function and local tests.
// deno-lint-ignore-file no-explicit-any
export interface Occurrence {
  uid: string
  title: string
  location: string | null
  start: string // ISO; all-day events are UTC midnight of their date
  end: string
  allDay: boolean
}

function toIso(t: any): string {
  if (t.isDate) {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${t.year}-${p(t.month)}-${p(t.day)}T00:00:00.000Z`
  }
  return t.toJSDate().toISOString()
}

/** Expand every event (recurring ones included, with their exceptions) that overlaps [from, to]. */
export function expandIcs(ICAL: any, text: string, from: Date, to: Date, maxPerEvent = 500): Occurrence[] {
  const root = new ICAL.Component(ICAL.parse(text))
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(new ICAL.Timezone(vtz)) } catch { /* already registered */ }
  }
  const vevents = root.getAllSubcomponents('vevent')
  const exceptions = new Map<string, any[]>()
  const masters: any[] = []
  for (const v of vevents) {
    const uid = v.getFirstPropertyValue('uid') ?? ''
    if (v.hasProperty('recurrence-id')) exceptions.set(uid, [...(exceptions.get(uid) ?? []), v])
    else masters.push(v)
  }

  const out: Occurrence[] = []
  const push = (uid: string, ev: any, s: any, e: any) => {
    if ((ev.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED') return
    const start = toIso(s)
    const end = e ? toIso(e) : start
    if (new Date(end) < from || new Date(start) > to) return
    out.push({ uid, title: ev.summary || '(No title)', location: ev.location || null, start, end, allDay: !!s.isDate })
  }

  for (const v of masters) {
    const ev = new ICAL.Event(v)
    const uid = ev.uid || crypto.randomUUID()
    for (const ex of exceptions.get(uid) ?? []) ev.relateException(ex)
    if (ev.isRecurring()) {
      const it = ev.iterator()
      let next, n = 0
      while ((next = it.next()) && n++ < 5000) {
        if (next.toJSDate() > to) break
        const d = ev.getOccurrenceDetails(next)
        push(uid, d.item, d.startDate, d.endDate)
        if (out.length > maxPerEvent * masters.length) break
      }
    } else {
      push(uid, ev, ev.startDate, ev.endDate)
    }
  }
  return out
}
