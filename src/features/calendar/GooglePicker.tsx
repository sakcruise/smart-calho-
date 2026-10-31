import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { CalendarSource, FamilyMember } from '../../lib/types'
import { addGoogleCalendars, listGoogleCalendars, type GoogleCalendarChoice } from './google'

/** After Google sign-in: tick which calendars to show and whose they are. */
export function GooglePicker({ loginId, members, existing, onDone }: {
  loginId: string; members: FamilyMember[]; existing: CalendarSource[]; onDone: (message?: string) => void
}) {
  const [email, setEmail] = useState('')
  const [cals, setCals] = useState<GoogleCalendarChoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [whose, setWhose] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)

  const already = new Set(existing.filter((s) => s.google_login_id === loginId).map((s) => s.google_calendar_id))

  useEffect(() => {
    void listGoogleCalendars(loginId).then((r) => {
      if (r.error || !r.calendars) { setError(r.error ?? 'Could not read your calendars.'); return }
      setEmail(r.email ?? '')
      const list = [...r.calendars].sort((a, b) => Number(b.primary) - Number(a.primary))
      setCals(list)
      setPicked(Object.fromEntries(list.filter((c) => c.primary).map((c) => [c.id, true])))
    })
  }, [loginId])

  async function save() {
    if (!cals) return
    const chosen = cals.filter((c) => picked[c.id] && !already.has(c.id))
    if (!chosen.length) { onDone(); return }
    setSaving(true)
    const r = await addGoogleCalendars(loginId, chosen.map((c) => ({ id: c.id, name: c.primary && email ? `${email.split('@')[0]}'s calendar` : c.name, member_ids: whose[c.id] ?? [] })))
    setSaving(false)
    if (r.error) setError(r.error)
    else onDone(`Connected ${chosen.length} calendar${chosen.length > 1 ? 's' : ''}. Events are loading now.`)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Choose Google calendars" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-3xl bg-cream p-5 lg:p-8">
        <div className="flex flex-col gap-1">
          <h3 className="text-2xl font-black">Which calendars should the wall show?</h3>
          {email && <p className="font-bold text-muted">Signed in as {email}</p>}
        </div>
        {error && <p className="rounded-2xl bg-white px-4 py-3 font-bold text-red-700">{error}</p>}
        {!cals && !error && <p className="font-bold text-muted">Reading your calendars…</p>}
        {cals?.map((c) => {
          const has = already.has(c.id)
          const on = has || !!picked[c.id]
          return (
            <div key={c.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4">
              <button type="button" disabled={has} aria-pressed={on} onClick={() => setPicked({ ...picked, [c.id]: !on })} className="flex items-center gap-3 text-left">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>{on && <Check size={20} />}</span>
                <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full" style={{ background: c.colour ?? '#999' }} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lg font-extrabold">{c.name}{c.primary ? ' (main)' : ''}</span>
                  <span className="text-sm font-bold text-muted">{has ? 'Already on the wall' : c.writable ? 'Two-way' : 'Read-only'}</span>
                </span>
              </button>
              {on && !has && (
                <div className="flex flex-wrap items-center gap-2 pl-11">
                  <span className="text-sm font-extrabold text-muted">Whose:</span>
                  {members.map((m) => {
                    const sel = (whose[c.id] ?? []).includes(m.id)
                    return (
                      <button key={m.id} type="button" aria-pressed={sel}
                        onClick={() => setWhose({ ...whose, [c.id]: sel ? (whose[c.id] ?? []).filter((x) => x !== m.id) : [...(whose[c.id] ?? []), m.id] })}
                        style={sel ? { background: m.colour, borderColor: m.colour } : undefined}
                        className={`rounded-full border-2 px-3 py-1 text-sm font-extrabold ${sel ? 'text-white' : 'border-line bg-white text-ink-2'}`}>{m.name}</button>
                    )
                  })}
                  <span className="text-sm font-bold text-faint">(none = family)</span>
                </div>
              )}
            </div>
          )
        })}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onDone()} className="rounded-full border-2 border-line px-5 py-3 font-extrabold text-ink-2">Cancel</button>
          <button type="button" disabled={!cals || saving} onClick={() => void save()} className="rounded-full bg-amber px-6 py-3 font-extrabold disabled:opacity-40">
            {saving ? 'Adding…' : 'Show on the wall'}
          </button>
        </div>
      </div>
    </div>
  )
}
