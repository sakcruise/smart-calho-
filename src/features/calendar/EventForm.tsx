import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { CalendarEvent, CalendarSource, EventRepeat, FamilyMember } from '../../lib/types'
import { writeGoogle } from './google'

const pad = (n: number) => String(n).padStart(2, '0')
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const REPEATS: { id: EventRepeat | 'none'; label: string }[] = [
  { id: 'none', label: "Doesn't repeat" }, { id: 'daily', label: 'Every day' }, { id: 'weekly', label: 'Every week' },
  { id: 'monthly', label: 'Every month' }, { id: 'yearly', label: 'Every year' },
]

/** Add or edit an event: a family event kept on this screen, or one in a connected Google calendar. */
export function EventForm({ members, event, day, writable = [], onClose }: { members: FamilyMember[]; event: CalendarEvent | null; day: Date; writable?: CalendarSource[]; onClose: () => void }) {
  const [target, setTarget] = useState<string>(event && event.source !== 'local' && event.source_id ? event.source_id : 'family')
  const google = target !== 'family'
  const editingGoogle = !!event && event.source !== 'local'
  const start0 = event ? (event.all_day ? new Date(new Date(event.starts_at).getUTCFullYear(), new Date(event.starts_at).getUTCMonth(), new Date(event.starts_at).getUTCDate()) : new Date(event.starts_at)) : (() => { const d = new Date(day); d.setHours(new Date().getHours() + 1, 0, 0, 0); return d })()
  const end0 = event ? new Date(event.ends_at) : new Date(start0.getTime() + 3600000)
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(dateStr(start0))
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [start, setStart] = useState(timeStr(start0))
  const [end, setEnd] = useState(timeStr(end0))
  const [who, setWho] = useState<string[]>(event?.member_ids ?? [])
  const [location, setLocation] = useState(event?.location ?? '')
  const [repeat, setRepeat] = useState<EventRepeat | 'none'>(event?.recurrence_rule ?? 'none')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !title.trim()) return
    let starts_at: string, ends_at: string
    if (allDay) {
      starts_at = `${date}T00:00:00.000Z`
      const [y, m, d] = date.split('-').map(Number)
      const next = new Date(Date.UTC(y, m - 1, d + 1))
      ends_at = next.toISOString()
    } else {
      const s = new Date(`${date}T${start}`), en = new Date(`${date}T${end}`)
      if (en <= s) { setError('The end time must be after the start time.'); return }
      starts_at = s.toISOString(); ends_at = en.toISOString()
    }
    setBusy(true); setError(null)
    if (google) {
      const r = await writeGoogle(event ? 'update' : 'create', target,
        { title: title.trim(), location: location.trim() || null, all_day: allDay, date, start: allDay ? undefined : starts_at, end: allDay ? undefined : ends_at, repeat: repeat === 'none' ? null : repeat },
        event?.external_id ?? undefined)
      setBusy(false)
      if (r.error) { setError(r.error); return }
      onClose(); return
    }
    const row = { title: title.trim(), starts_at, ends_at, all_day: allDay, member_ids: who, location: location.trim() || null, recurrence_rule: repeat === 'none' ? null : repeat }
    const res = event
      ? await supabase.from('events').update(row).eq('id', event.id)
      : await supabase.from('events').insert({ ...row, source: 'local' })
    setBusy(false)
    if (res.error) { setError(res.error.message); return }
    onClose()
  }

  async function remove() {
    if (!supabase || !event) return
    if (editingGoogle && event.source_id) {
      setBusy(true)
      const r = await writeGoogle('delete', event.source_id, undefined, event.external_id ?? undefined)
      setBusy(false)
      if (r.error) { setError(r.error); return }
      onClose(); return
    }
    await supabase.from('events').delete().eq('id', event.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={onClose}>
      <form onSubmit={save} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-xl flex-col gap-4 overflow-auto rounded-t-[28px] bg-cream p-5 sm:rounded-[32px] lg:p-8">
        <h2 className="text-2xl font-black lg:text-3xl">{event ? 'Edit event' : 'New event'}</h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">What</span>
          <input id="ev-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Swimming lesson"
            className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-sm font-extrabold text-muted">Date</span>
            <input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-2xl border-2 border-line bg-white px-3 py-3 font-bold" />
          </label>
          <label className="col-span-2 flex items-center gap-3 self-end py-3 font-extrabold sm:col-span-1">
            <input id="ev-allday" type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-6 w-6 accent-amber-600" />All day
          </label>
          {!allDay && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-extrabold text-muted">From</span>
                <input id="ev-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-2xl border-2 border-line bg-white px-3 py-3 font-bold" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-extrabold text-muted">To</span>
                <input id="ev-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-2xl border-2 border-line bg-white px-3 py-3 font-bold" />
              </label>
            </>
          )}
        </div>
        {writable.length > 0 && !event && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-extrabold text-muted">Save to</span>
            <div className="flex flex-wrap gap-2">
              {[{ id: 'family', label: 'Family (this calendar only)' }, ...writable.map((s) => ({ id: s.id, label: s.name }))].map((o) => (
                <button key={o.id} type="button" aria-pressed={target === o.id} onClick={() => setTarget(o.id)}
                  className={`rounded-full border-2 px-4 py-2 font-extrabold ${target === o.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2'}`}>{o.label}</button>
              ))}
            </div>
          </div>
        )}
        {google ? (
          <p className="text-sm font-bold text-muted">
            {editingGoogle ? 'This changes the event in Google Calendar.' : 'Adds it to Google Calendar; it shows here in that calendar\'s colour within a few seconds.'}
          </p>
        ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold text-muted">Who (none = everyone)</span>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = who.includes(m.id)
              return (
                <button key={m.id} type="button" aria-pressed={on} onClick={() => setWho(on ? who.filter((x) => x !== m.id) : [...who, m.id])}
                  style={on ? { background: m.colour, borderColor: m.colour } : undefined}
                  className={`rounded-full border-2 px-4 py-2 font-extrabold ${on ? 'text-white' : 'border-line bg-white text-ink-2'}`}>{m.name}</button>
              )
            })}
          </div>
        </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-muted">Where</span>
            <input id="ev-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional" className="rounded-2xl border-2 border-line bg-white px-4 py-3 font-bold" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-muted">Repeat</span>
            <select id="ev-repeat" disabled={editingGoogle} value={repeat} onChange={(e) => setRepeat(e.target.value as EventRepeat | 'none')} className="rounded-2xl border-2 border-line bg-white px-3 py-3 font-bold">
              {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800">{error}</p>}
        <div className="flex flex-wrap justify-between gap-3 border-t-2 border-sand pt-4">
          {event ? (confirmDelete
            ? <button type="button" onClick={() => void remove()} className="rounded-full bg-red-700 px-5 py-3 font-extrabold text-white">Yes, delete{event.recurrence_rule ? ' all' : ''}</button>
            : <button type="button" onClick={() => setConfirmDelete(true)} className="px-2 py-3 font-extrabold text-red-700">Delete event</button>) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full border-2 border-line bg-white px-5 py-3 font-extrabold text-ink-2">Cancel</button>
            <button type="submit" disabled={!title.trim() || busy} className="rounded-full bg-ink px-6 py-3 font-extrabold text-white disabled:opacity-40">{event ? 'Save' : 'Add event'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
