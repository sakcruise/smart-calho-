import { useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import type { CalendarSource, FamilyMember } from '../../lib/types'
import { syncCalendars } from './useEvents'
import { connectGoogle } from './google'
import { GoogleSetup } from './GoogleSetup'
import { PenLine } from 'lucide-react'
import { useEffect } from 'react'

const HOWTO: Record<CalendarSource['provider'], { label: string; steps: string[] }> = {
  google: {
    label: 'Google Calendar',
    steps: [
      'On a computer, open calendar.google.com (the phone app doesn\'t show this setting).',
      'Next to the calendar on the left, choose ⋮ → Settings and sharing.',
      'Scroll to "Integrate calendar" and copy "Secret address in iCal format".',
      'Paste it below. Repeat for each person\'s calendar.',
    ],
  },
  microsoft: {
    label: 'Outlook / Microsoft 365',
    steps: ['In Outlook on the web: Settings → Calendar → Shared calendars → Publish a calendar.', 'Choose "Can view all details", Publish, then copy the ICS link.'],
  },
  other: {
    label: 'Apple iCloud or other',
    steps: ['In iCloud Calendar, share the calendar as a Public Calendar and copy the webcal:// link.', 'Any calendar that offers an .ics or webcal link works.'],
  },
}

/** Connect calendars by their private iCal link; read-only, refreshed every 15 minutes. */
export function CalendarConnections({ members }: { members: FamilyMember[] }) {
  const { rows: sources } = useTable<CalendarSource>('calendar_sources', 'created_at')
  const [provider, setProvider] = useState<CalendarSource['provider']>('google')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [who, setWho] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const urlOk = /^(https|webcal):\/\/\S+$/i.test(url.trim())

  // Coming back from Google's approval page
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const g = p.get('google')
    if (!g) return
    setMessage(g === 'connected' ? 'Google connected. The wall can now add events to that calendar.' : g === 'cancelled' ? 'Google connection cancelled.' : "Google didn't connect. Try again, and make sure the app is published (step 4).")
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !name.trim() || !urlOk) return
    setBusy('add'); setMessage(null)
    const { data, error } = await supabase.from('calendar_sources')
      .insert({ name: name.trim(), provider, url: url.trim(), member_ids: who }).select().single()
    if (error || !data) { setBusy(null); setMessage(error?.message ?? 'Could not save that calendar.'); return }
    const res = await syncCalendars((data as CalendarSource).id)
    setBusy(null)
    const r = res.results?.[0]
    setMessage(res.error ? `Saved, but the first sync failed: ${res.error}` : r?.error ? `Saved, but: ${r.error}` : `Connected. ${r?.events ?? 0} events loaded.`)
    if (!res.error && !r?.error) { setName(''); setUrl(''); setWho([]) }
  }

  async function syncOne(s: CalendarSource) {
    setBusy(s.id); setMessage(null)
    const res = await syncCalendars(s.id)
    setBusy(null)
    if (res.error) setMessage(`Sync failed: ${res.error}`)
  }

  async function remove(s: CalendarSource) {
    await supabase?.from('calendar_sources').delete().eq('id', s.id) // its events go with it
    setConfirmDelete(null)
  }

  async function setMembers(s: CalendarSource, ids: string[]) {
    await supabase?.from('calendar_sources').update({ member_ids: ids }).eq('id', s.id)
    await supabase?.from('events').update({ member_ids: ids }).eq('source_id', s.id)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black lg:text-3xl">Calendar connections</h2>
        <p className="font-bold text-muted">Connected calendars show on the Week screen and refresh every 15 minutes. Edit those events in their own app.</p>
      </div>

      {sources.some((s) => s.provider === 'google') && <GoogleSetup />}

      {sources.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-2">
          {sources.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 rounded-3xl bg-white p-4">
              <div className="flex items-start gap-3">
                {s.last_error ? <AlertTriangle aria-hidden="true" className="mt-1 shrink-0 text-red-700" /> : <CheckCircle2 aria-hidden="true" className="mt-1 shrink-0 text-green-700" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lg font-extrabold">{s.name}</span>
                  <span className="text-sm font-bold text-muted">
                    {HOWTO[s.provider]?.label ?? 'Calendar'} · {s.last_synced_at ? `${s.event_count} events · synced ${new Date(s.last_synced_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'}
                  </span>
                  {s.last_error && <span className="text-sm font-bold text-red-700">{s.last_error}</span>}
                </div>
                <button type="button" onClick={() => void syncOne(s)} disabled={busy === s.id} aria-label={`Sync ${s.name} now`}
                  className="rounded-full border-2 border-line p-2.5 text-ink-2 disabled:opacity-50"><RefreshCw size={18} className={busy === s.id ? 'animate-spin' : ''} /></button>
                {confirmDelete === s.id
                  ? <button type="button" onClick={() => void remove(s)} className="rounded-full bg-red-700 px-3 py-2 text-sm font-extrabold text-white">Remove</button>
                  : <button type="button" onClick={() => setConfirmDelete(s.id)} aria-label={`Remove ${s.name}`} className="rounded-full border-2 border-line p-2.5 text-ink-2"><Trash2 size={18} /></button>}
              </div>
              {s.provider === 'google' && (
                s.can_write ? (
                  <p className="flex items-center gap-2 text-sm font-extrabold text-green-700"><PenLine aria-hidden="true" size={16} />The wall can add and edit events{s.google_email ? ` · ${s.google_email}` : ''}</p>
                ) : (
                  <button type="button" onClick={() => void connectGoogle(s.id).then((r) => r.error && setMessage(r.error))}
                    className="flex items-center gap-2 self-start rounded-full border-2 border-amber px-4 py-2 text-sm font-extrabold">
                    <PenLine aria-hidden="true" size={16} />Let the wall add events
                  </button>
                )
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold text-muted">Whose:</span>
                {members.map((m) => {
                  const on = s.member_ids.includes(m.id)
                  return (
                    <button key={m.id} type="button" aria-pressed={on} onClick={() => void setMembers(s, on ? s.member_ids.filter((x) => x !== m.id) : [...s.member_ids, m.id])}
                      style={on ? { background: m.colour, borderColor: m.colour } : undefined}
                      className={`rounded-full border-2 px-3 py-1 text-sm font-extrabold ${on ? 'text-white' : 'border-line bg-white text-ink-2'}`}>{m.name}</button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="flex flex-col gap-4 rounded-3xl border-2 border-dashed border-line p-4 lg:p-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(HOWTO) as CalendarSource['provider'][]).map((p) => (
            <button key={p} type="button" aria-pressed={provider === p} onClick={() => setProvider(p)}
              className={`rounded-full px-4 py-2 font-extrabold ${provider === p ? 'bg-ink text-white' : 'border-2 border-line bg-white text-ink-2'}`}>{HOWTO[p].label}</button>
          ))}
        </div>
        <ol className="list-decimal space-y-1 pl-6 font-bold text-ink-2">
          {HOWTO[provider].steps.map((st) => <li key={st}>{st}</li>)}
        </ol>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-muted">Name</span>
            <input id="cal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dad's calendar" className="rounded-2xl border-2 border-line bg-white px-4 py-3 font-bold" />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-extrabold text-muted">Private iCal link</span>
            <input id="cal-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/private-…/basic.ics" autoComplete="off" spellCheck={false}
              className="min-w-0 rounded-2xl border-2 border-line bg-white px-4 py-3 font-bold" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold text-muted">Whose calendar:</span>
          {members.map((m) => {
            const on = who.includes(m.id)
            return (
              <button key={m.id} type="button" aria-pressed={on} onClick={() => setWho(on ? who.filter((x) => x !== m.id) : [...who, m.id])}
                style={on ? { background: m.colour, borderColor: m.colour } : undefined}
                className={`rounded-full border-2 px-3 py-1.5 font-extrabold ${on ? 'text-white' : 'border-line bg-white text-ink-2'}`}>{m.name}</button>
            )
          })}
          <span className="text-sm font-bold text-faint">(none = family)</span>
        </div>
        <p className="text-sm font-bold text-muted">The secret link lets anyone holding it read that calendar. It's stored only in your family's database.</p>
        {message && <p className="rounded-2xl bg-white px-4 py-3 font-bold">{message}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={!name.trim() || !urlOk || busy === 'add'} className="rounded-full bg-amber px-6 py-3 font-extrabold disabled:opacity-40">
            {busy === 'add' ? 'Connecting…' : 'Connect calendar'}
          </button>
        </div>
      </form>
    </section>
  )
}
