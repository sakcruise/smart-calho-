import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { FamilyMember, Recurrence, Reminder } from '../../lib/types'
import { Avatar } from '../../components/Avatar'
import { RECURRENCE_LABELS, chime, fireAt, formatDue } from './logic'
import { useReminders } from './useReminders'

function localDateTimeDefault() {
  const d = new Date(Date.now() + 60 * 60000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Reminders panel: add, see upcoming, snooze, done, delete. */
export function Reminders({ members }: { members: FamilyMember[] }) {
  const { due, upcoming, snooze, dismiss, remove } = useReminders()
  const [text, setText] = useState('')
  const [when, setWhen] = useState(localDateTimeDefault)
  const [memberId, setMemberId] = useState<string>('')
  const [rule, setRule] = useState<Recurrence>('none')

  async function add(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!supabase || !t || !when) return
    await supabase.from('reminders').insert({
      text: t, due_at: new Date(when).toISOString(), member_id: memberId || null, recurrence_rule: rule === 'none' ? null : rule,
    })
    setText(''); setWhen(localDateTimeDefault()); setRule('none')
  }

  const who = (r: Reminder) => members.find((m) => m.id === r.member_id)
  const all = [...due, ...upcoming]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <h2 className="text-2xl font-black lg:text-4xl">Reminders</h2>
      <form onSubmit={add} className="grid grid-cols-2 gap-2 rounded-[20px] bg-cream p-3 md:grid-cols-[1fr_auto_auto_auto_auto] lg:gap-3 lg:rounded-[24px] lg:p-5">
        <input id="rem-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Remind us to…" autoComplete="off"
          className="col-span-2 min-w-0 rounded-[14px] border-2 border-line bg-white px-4 py-3 text-lg font-bold md:col-span-1 lg:rounded-[18px] lg:px-5 lg:py-3.5 lg:text-xl" />
        <input id="rem-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="When"
          className="col-span-2 min-w-0 rounded-[14px] border-2 border-line bg-white px-3 py-3 text-base font-bold md:col-span-1 lg:rounded-[18px] lg:px-4 lg:py-3.5 lg:text-lg" />
        <select id="rem-who" value={memberId} onChange={(e) => setMemberId(e.target.value)} aria-label="Who"
          className="min-w-0 rounded-[14px] border-2 border-line bg-white px-3 py-3 text-base font-bold lg:rounded-[18px] lg:px-4 lg:py-3.5 lg:text-lg">
          <option value="">Everyone</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select id="rem-rule" value={rule} onChange={(e) => setRule(e.target.value as Recurrence)} aria-label="Repeat"
          className="min-w-0 rounded-[14px] border-2 border-line bg-white px-3 py-3 text-base font-bold lg:rounded-[18px] lg:px-4 lg:py-3.5 lg:text-lg">
          {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((k) => <option key={k} value={k}>{RECURRENCE_LABELS[k]}</option>)}
        </select>
        <button type="submit" disabled={!text.trim()} className="col-span-2 rounded-[14px] bg-amber px-7 py-3 text-lg font-extrabold disabled:opacity-40 md:col-span-1 lg:rounded-[18px] lg:text-xl">Add</button>
      </form>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {all.length === 0 && <p className="py-6 text-xl font-bold text-faint">No reminders yet.</p>}
        {all.map((r) => {
          const m = who(r)
          const isDueNow = due.includes(r)
          return (
            <div key={r.id} className={`flex flex-wrap items-center gap-3 rounded-[18px] px-3 py-3 lg:flex-nowrap lg:gap-4 lg:rounded-[20px] lg:px-5 lg:py-4 ${isDueNow ? 'bg-[#FFF3D6]' : 'bg-cream'}`}>
              {m ? <Avatar name={m.name} colour={m.colour} size={44} /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-sm font-black text-white">All</span>}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-lg font-extrabold lg:text-2xl">{r.text}</span>
                <span className="text-sm font-bold text-muted lg:text-base">
                  {isDueNow ? 'Due now' : formatDue(fireAt(r).toISOString())}
                  {r.recurrence_rule ? ` · ${RECURRENCE_LABELS[r.recurrence_rule]}` : ''}
                  {m ? ` · ${m.name}` : ''}
                </span>
              </div>
              {isDueNow && <button type="button" onClick={() => void snooze(r)} className="rounded-full border-2 border-line bg-white px-4 py-2.5 font-extrabold text-ink-2">Snooze 10 min</button>}
              <button type="button" onClick={() => void dismiss(r)} className="rounded-full bg-green-600 px-5 py-2.5 font-extrabold text-white">Done</button>
              <button type="button" onClick={() => void remove(r)} aria-label={`Delete ${r.text}`} className="rounded-full px-3 py-2.5 text-xl font-extrabold text-faint">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Banner shown on every screen when a reminder is due. Chimes once per reminder. */
export function ReminderBanner() {
  const { due, snooze, dismiss } = useReminders()
  const chimed = useRef(new Set<string>())
  const first = due[0]

  useEffect(() => {
    if (first && !chimed.current.has(first.id)) { chimed.current.add(first.id); chime() }
  }, [first])

  if (!first) return null
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 bg-amber px-4 py-3 text-ink lg:flex-nowrap lg:gap-5 lg:px-10 lg:py-4">
      <BellIcon />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-lg font-black lg:text-2xl">{first.text}</span>
        <span className="font-bold text-amber-deep">Reminder{due.length > 1 ? ` · ${due.length - 1} more waiting` : ''}</span>
      </div>
      <button type="button" onClick={() => void snooze(first)} className="rounded-full border-2 border-ink/30 px-4 py-2 text-base font-extrabold lg:px-5 lg:py-3 lg:text-lg">Snooze 10 min</button>
      <button type="button" onClick={() => void dismiss(first)} className="rounded-full bg-ink px-5 py-2 text-base font-extrabold text-white lg:px-6 lg:py-3 lg:text-lg">Done</button>
    </div>
  )
}

function BellIcon() {
  return (
    <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  )
}
