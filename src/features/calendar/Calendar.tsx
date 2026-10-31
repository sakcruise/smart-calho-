import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Plus, RefreshCw, X } from 'lucide-react'
import type { CalendarSource, FamilyMember } from '../../lib/types'
import { useTable } from '../../lib/useTable'
import { EventForm } from './EventForm'
import { addDays, fmtTime, occurrences, onDay, sameDay, startOfDay, startOfMonth, startOfWeek, type Occurrence } from './dates'
import { useEvents } from './useEvents'

type View = 'day' | 'week' | 'month'
const EVERYONE = '#2E9E63'
const HOUR_FROM = 6, HOUR_TO = 22, HOUR_PX = 64

interface Props {
  members: FamilyMember[]
  /** Runs fn once a parent has entered the PIN (immediately if already unlocked). */
  requireParent: (fn: () => void) => void
}

export function Calendar({ members, requireParent }: Props) {
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [open, setOpen] = useState<Occurrence | null>(null)
  const [form, setForm] = useState<{ event: Occurrence['event'] | null; day: Date } | null>(null)
  const { rows: sources } = useTable<CalendarSource>('calendar_sources', 'created_at')

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: addDays(cursor, 1) }
    if (view === 'week') { const s = startOfWeek(cursor); return { from: s, to: addDays(s, 7) } }
    const s = startOfWeek(startOfMonth(cursor)); return { from: s, to: addDays(s, 42) }
  }, [view, cursor])
  const events = useEvents(range.from, range.to)
  const occ = useMemo(() => occurrences(events, range.from, range.to), [events, range])

  const colourOf = (o: Occurrence) => members.find((m) => o.event.member_ids.includes(m.id))?.colour ?? EVERYONE
  const whoOf = (o: Occurrence) => o.event.member_ids.length === 0 ? 'Everyone' : members.filter((m) => o.event.member_ids.includes(m.id)).map((m) => m.name).join(', ')
  const today = startOfDay(new Date())

  function step(n: number) {
    if (view === 'day') setCursor(addDays(cursor, n))
    else if (view === 'week') setCursor(addDays(cursor, 7 * n))
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  }

  const title = view === 'day'
    ? cursor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : view === 'week'
      ? (() => { const s = startOfWeek(cursor), e = addDays(s, 6); return s.getMonth() === e.getMonth()
          ? `${s.getDate()} – ${e.getDate()} ${e.toLocaleDateString('en-GB', { month: 'long' })}`
          : `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` })()
      : cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const addEvent = (day: Date) => requireParent(() => setForm({ event: null, day }))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-4 lg:gap-4 lg:px-14 lg:py-6">
        <div className="flex items-center gap-2 lg:gap-4">
          <button type="button" aria-label="Previous" onClick={() => step(-1)} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white lg:h-14 lg:w-14"><ChevronLeft /></button>
          <h1 className="min-w-0 text-xl font-black lg:text-4xl">{title}</h1>
          <button type="button" aria-label="Next" onClick={() => step(1)} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line bg-white lg:h-14 lg:w-14"><ChevronRight /></button>
          {!sameDay(cursor, today) && (
            <button type="button" onClick={() => setCursor(today)} className="rounded-full border-2 border-line bg-white px-4 py-2 font-extrabold text-ink-2 lg:text-lg">Today</button>
          )}
        </div>
        <div className="flex w-full items-center gap-2 lg:w-auto lg:gap-3">
          <div className="hidden items-center gap-4 pr-2 text-base font-extrabold text-ink-2 xl:flex">
            {members.map((m) => <span key={m.id} className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full" style={{ background: m.colour }} />{m.name}</span>)}
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full" style={{ background: EVERYONE }} />Everyone</span>
          </div>
          <div className="flex flex-1 gap-1.5 lg:flex-none lg:gap-2" role="tablist" aria-label="Calendar view">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`flex-1 rounded-full px-3 py-2.5 text-base font-extrabold capitalize lg:flex-none lg:px-6 lg:py-3 lg:text-xl ${view === v ? 'bg-ink text-white' : 'border-2 border-line bg-white text-ink-2'}`}>{v}</button>
            ))}
          </div>
          <button type="button" onClick={() => addEvent(cursor)} className="flex items-center gap-1.5 rounded-full bg-amber px-4 py-2.5 font-extrabold lg:px-6 lg:py-3 lg:text-xl">
            <Plus aria-hidden="true" size={22} strokeWidth={3} />Add
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 lg:px-14">
        {view === 'week' && (
          <div className="grid grid-cols-1 gap-3 lg:h-full lg:grid-cols-7 lg:gap-3.5">
            {Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)).map((day) => {
              const list = onDay(occ, day)
              const isToday = sameDay(day, today)
              const weekend = day.getDay() === 0 || day.getDay() === 6
              return (
                <section key={day.toISOString()} className={`flex min-w-0 flex-col gap-2 rounded-[24px] p-3 lg:min-h-0 lg:gap-2.5 lg:rounded-[28px] lg:p-4 ${isToday ? 'border-[3px] border-amber bg-[#FFF3D6]' : weekend ? 'bg-[#F3EFE6]' : 'bg-white'}`}>
                  <button type="button" onClick={() => { setCursor(day); setView('day') }} className="flex items-baseline gap-2 text-left lg:flex-col lg:items-start lg:gap-0">
                    <span className={`text-sm font-extrabold uppercase tracking-[0.08em] lg:text-base ${isToday ? 'text-amber-deep' : 'text-faint'}`}>
                      {day.toLocaleDateString('en-GB', { weekday: 'short' })}{isToday ? ' · today' : ''}
                    </span>
                    <span className="text-2xl font-black lg:text-4xl">{day.getDate()}</span>
                  </button>
                  <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-auto">
                    {list.map((o) => <Chip key={o.key} o={o} colour={colourOf(o)} who={whoOf(o)} onOpen={() => setOpen(o)} light={isToday || weekend} />)}
                    {list.length === 0 && <span className="hidden text-sm font-bold text-faint lg:block">Nothing planned</span>}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {view === 'day' && (() => {
          const list = onDay(occ, cursor)
          const allDay = list.filter((o) => o.allDay)
          const timed = list.filter((o) => !o.allDay)
          const now = new Date()
          return (
            <div className="flex flex-col gap-3 rounded-[28px] bg-white p-4 lg:p-6">
              {allDay.length > 0 && <div className="flex flex-wrap gap-2">{allDay.map((o) => <Chip key={o.key} o={o} colour={colourOf(o)} who={whoOf(o)} onOpen={() => setOpen(o)} />)}</div>}
              <div className="relative" style={{ height: (HOUR_TO - HOUR_FROM) * HOUR_PX }}>
                {Array.from({ length: HOUR_TO - HOUR_FROM }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 flex border-t border-sand" style={{ top: i * HOUR_PX }}>
                    <span className="w-14 -translate-y-3 bg-white pr-2 text-right text-sm font-bold text-faint lg:w-16 lg:text-base">{String(HOUR_FROM + i).padStart(2, '0')}:00</span>
                  </div>
                ))}
                {sameDay(cursor, now) && now.getHours() >= HOUR_FROM && now.getHours() < HOUR_TO && (
                  <div className="absolute left-14 right-0 z-10 border-t-[3px] border-red-500 lg:left-16" style={{ top: (now.getHours() - HOUR_FROM + now.getMinutes() / 60) * HOUR_PX }} />
                )}
                {layoutColumns(timed).map(({ o, col, cols }) => {
                  const s = Math.max(HOUR_FROM, o.start.getHours() + o.start.getMinutes() / 60)
                  const e = Math.min(HOUR_TO, sameDay(o.end, o.start) ? o.end.getHours() + o.end.getMinutes() / 60 : HOUR_TO)
                  const top = (s - HOUR_FROM) * HOUR_PX, height = Math.max(36, (e - s) * HOUR_PX - 4)
                  return (
                    <button key={o.key} type="button" onClick={() => setOpen(o)}
                      className="absolute overflow-hidden rounded-xl border-l-8 bg-cream px-3 py-1.5 text-left"
                      style={{ top, height, left: `calc(4rem + (100% - 4rem) * ${col / cols})`, width: `calc((100% - 4rem) / ${cols} - 6px)`, borderLeftColor: colourOf(o) }}>
                      <div className="truncate text-base font-extrabold lg:text-lg">{o.event.title}</div>
                      <div className="truncate text-sm font-bold text-muted">{fmtTime(o.start)}–{fmtTime(o.end)} · {whoOf(o)}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {view === 'month' && (() => {
          const first = startOfWeek(startOfMonth(cursor))
          const days = Array.from({ length: 42 }, (_, i) => addDays(first, i))
          return (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-7 gap-1.5 lg:gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="text-center text-xs font-extrabold uppercase tracking-[0.08em] text-faint lg:text-base">{d}</span>)}
                {days.map((day) => {
                  const list = onDay(occ, day)
                  const inMonth = day.getMonth() === cursor.getMonth()
                  const isToday = sameDay(day, today)
                  return (
                    <button key={day.toISOString()} type="button" onClick={() => { setCursor(day); setView('day') }}
                      className={`flex min-h-16 min-w-0 flex-col gap-1 rounded-xl p-1.5 text-left lg:min-h-32 lg:rounded-2xl lg:p-2.5 ${isToday ? 'border-[3px] border-amber bg-[#FFF3D6]' : inMonth ? 'bg-white' : 'bg-white/40'}`}>
                      <span className={`text-sm font-black lg:text-xl ${inMonth ? '' : 'text-faint'}`}>{day.getDate()}</span>
                      <span className="flex flex-wrap gap-1 lg:hidden">
                        {list.slice(0, 4).map((o) => <span key={o.key} className="h-2 w-2 rounded-full" style={{ background: colourOf(o) }} />)}
                      </span>
                      <span className="hidden flex-col gap-1 lg:flex">
                        {list.slice(0, 3).map((o) => (
                          <span key={o.key} className="truncate rounded-md px-1.5 py-0.5 text-sm font-extrabold text-white" style={{ background: colourOf(o) }}>
                            {o.allDay ? '' : `${fmtTime(o.start)} `}{o.event.title}
                          </span>
                        ))}
                        {list.length > 3 && <span className="text-sm font-extrabold text-muted">+{list.length - 3} more</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-lg flex-col gap-4 rounded-t-[28px] bg-cream p-6 sm:rounded-[32px] lg:p-8">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-10 w-2.5 shrink-0 rounded-md" style={{ background: colourOf(open) }} />
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="text-2xl font-black lg:text-3xl">{open.event.title}</h2>
                <span className="text-lg font-bold text-muted">
                  {open.start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {open.allDay ? ' · all day' : ` · ${fmtTime(open.start)}–${fmtTime(open.end)}`}
                </span>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="rounded-full bg-white p-2.5"><X /></button>
            </div>
            <p className="font-bold text-ink-2">{whoOf(open)}</p>
            {open.event.location && <p className="flex items-center gap-2 font-bold text-ink-2"><MapPin aria-hidden="true" size={20} />{open.event.location}</p>}
            {open.event.source === 'local' ? (
              <div className="flex justify-end">
                <button type="button" onClick={() => { const ev = open.event; setOpen(null); requireParent(() => setForm({ event: ev, day: cursor })) }}
                  className="rounded-full bg-ink px-6 py-3 font-extrabold text-white">Edit</button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm font-bold text-muted">
                <RefreshCw aria-hidden="true" size={16} />
                From {sources.find((s) => s.id === open.event.source_id)?.name ?? 'a connected calendar'}. Change it there; it updates here within 15 minutes.
              </p>
            )}
          </div>
        </div>
      )}

      {form && <EventForm members={members} event={form.event} day={form.day} onClose={() => setForm(null)} />}
    </div>
  )
}

function Chip({ o, colour, who, onOpen, light = false }: { o: Occurrence; colour: string; who: string; onOpen: () => void; light?: boolean }) {
  return (
    <button type="button" onClick={onOpen} style={{ borderLeftColor: colour }}
      className={`flex min-w-0 flex-col rounded-[14px] border-l-8 px-3 py-2 text-left ${light ? 'bg-white' : 'bg-cream'}`}>
      <span className="truncate text-base font-extrabold lg:text-[17px]">{o.allDay ? '' : `${fmtTime(o.start)} `}{o.event.title}</span>
      <span className="truncate text-sm font-bold text-muted">{o.allDay ? 'All day · ' : ''}{who}</span>
    </button>
  )
}

/** Side-by-side columns for overlapping timed events in the day view. */
function layoutColumns(list: Occurrence[]) {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime())
  const out: { o: Occurrence; col: number; cols: number }[] = []
  let group: { o: Occurrence; col: number }[] = []
  let groupEnd = 0
  const flush = () => { const cols = Math.max(1, ...group.map((g) => g.col + 1)); group.forEach((g) => out.push({ ...g, cols })); group = [] }
  for (const o of sorted) {
    if (group.length && o.start.getTime() >= groupEnd) flush()
    const used = new Set(group.filter((g) => g.o.end > o.start).map((g) => g.col))
    let col = 0
    while (used.has(col)) col++
    group.push({ o, col })
    groupEnd = Math.max(groupEnd, o.end.getTime())
  }
  flush()
  return out
}
