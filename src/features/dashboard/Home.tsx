import { Clock } from './Clock'
import { useWeather } from './useWeather'
import type { FamilyMember } from '../../lib/types'
import { Avatar } from '../../components/Avatar'
import { useReminders } from '../reminders/useReminders'
import { fireAt, formatDue } from '../reminders/logic'
import { isScheduled, useTasks } from '../tasks/useTasks'
import { useEvents } from '../calendar/useEvents'
import { addDays, fmtTime, occurrences, sameDay, startOfDay } from '../calendar/dates'
import { useMemo } from 'react'
import { Images, Pause } from 'lucide-react'
import { PhotoBackdrop, usePhotoUrls } from './PhotoBackdrop'

interface Props {
  members: FamilyMember[]
  familyName: string
  location: { name: string; lat: number; lon: number }
  onOpenTasks: () => void
  photosOn: boolean
  onTogglePhotos: () => void
}

export function Home({ members, familyName, location, onOpenTasks, photosOn, onTogglePhotos }: Props) {
  const urls = usePhotoUrls()
  const showPhotos = photosOn && urls.length > 0
  const weather = useWeather(location.lat, location.lon)
  const kids = members.filter((m) => m.role === 'kid')
  const { upcoming } = useReminders()
  const [from, to] = useMemo(() => { const s = startOfDay(new Date()); return [s, addDays(s, 8)] }, [])
  const events = useEvents(from, to)
  const next = useMemo(() => {
    const now = new Date()
    const evs = occurrences(events, from, to)
      .filter((o) => (o.allDay ? o.end > now : o.end > now))
      .map((o) => ({
        key: o.key, title: o.event.title, at: o.start, colour: members.find((m) => o.event.member_ids.includes(m.id))?.colour ?? '#2E9E63',
        who: o.event.member_ids.length ? members.filter((m) => o.event.member_ids.includes(m.id)).map((m) => m.name).join(', ') : 'Everyone',
        when: `${sameDay(o.start, now) ? 'Today' : sameDay(o.start, addDays(now, 1)) ? 'Tomorrow' : o.start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${o.allDay ? '' : ` · ${fmtTime(o.start)}`}`,
      }))
    const rems = upcoming.slice(0, 4).map((r) => {
      const m = members.find((x) => x.id === r.member_id)
      return { key: r.id, title: r.text, at: fireAt(r), colour: m?.colour ?? '#2E9E63', who: m?.name ?? 'Everyone', when: formatDue(fireAt(r).toISOString()) }
    })
    return [...evs, ...rems].sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 4)
  }, [events, from, to, upcoming, members])
  const board = useTasks()

  const progress = (kid: FamilyMember) => {
    const list = board.tasks.filter((t) => isScheduled(t, 'all') && !t.all_members && t.assignee_ids.includes(kid.id))
    const done = list.filter((t) => board.completionFor(t.id, kid.id)).length
    return { done, total: list.length }
  }

  return (
    <div className="flex min-h-full flex-col lg:h-full lg:min-h-0 lg:flex-row">
      <section className="relative flex min-h-[60vh] flex-col justify-between gap-6 overflow-hidden bg-sand p-5 pt-16 lg:min-h-0 lg:flex-1 lg:p-16 lg:pt-20">
        {showPhotos && <PhotoBackdrop urls={urls} />}
        <div className="absolute inset-x-4 top-3 flex items-center justify-between gap-3 lg:inset-x-6 lg:top-6">
          <button type="button" onClick={onTogglePhotos} aria-pressed={photosOn}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold lg:px-5 lg:py-2.5 lg:text-lg ${showPhotos ? 'bg-black/35 text-white backdrop-blur' : 'bg-cream text-ink-2'}`}>
            {photosOn ? <Pause aria-hidden="true" size={20} /> : <Images aria-hidden="true" size={20} />}
            {photosOn ? 'Stop photos' : 'Play photos'}
          </button>
          <p className={`truncate text-base font-extrabold lg:text-lg ${showPhotos ? 'text-white drop-shadow' : 'text-faint'}`}>{familyName}</p>
        </div>
        {photosOn && urls.length === 0 && (
          <p className="relative rounded-2xl bg-cream px-4 py-3 font-bold text-muted">No photos yet. Add some in Parents → Photos.</p>
        )}
        <Clock onPhoto={showPhotos} />
        <div className="relative flex w-full items-center gap-4 rounded-[24px] bg-cream px-5 py-4 lg:w-fit lg:gap-6 lg:rounded-[28px] lg:px-8 lg:py-5">
          <SunIcon />
          <div className="flex min-w-0 flex-col">
            <span className="text-2xl font-extrabold leading-tight lg:text-4xl">
              {weather ? `${weather.temp}°` : '—'}{' '}
              <span className="block text-base font-bold text-muted lg:inline lg:text-2xl">{weather ? `${weather.label}, high ${weather.high}° low ${weather.low}°` : 'Fetching weather…'}</span>
            </span>
            <span className="mt-1 text-sm font-bold text-muted lg:text-xl">
              {location.name}{weather?.nextRainDay ? ` · rain from ${weather.nextRainDay}` : ''}
            </span>
          </div>
        </div>
      </section>

      <aside className="flex w-full flex-col gap-7 p-5 lg:w-[520px] lg:shrink-0 lg:gap-9 lg:overflow-hidden lg:p-10">
        <div className="flex flex-col gap-3 lg:gap-4">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-faint lg:text-lg">Next up</h2>
          {next.length === 0 && <div className="rounded-3xl border-2 border-dashed border-line p-5 font-bold text-faint">Nothing coming up this week.</div>}
          {next.map((n) => (
            <div key={n.key} className="flex items-center gap-4 rounded-3xl bg-white px-4 py-3 lg:px-5 lg:py-4">
              <span style={{ background: n.colour }} className="h-12 w-2.5 shrink-0 rounded-md lg:h-14" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-lg font-extrabold lg:text-2xl">{n.title}</span>
                <span className="text-sm font-bold text-muted lg:text-base">{n.who} · {n.when}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 lg:gap-4">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-faint lg:text-lg">Today's tasks</h2>
          <div className="grid grid-cols-2 gap-3">
            {kids.map((k) => {
              const { done, total } = progress(k)
              const pct = total ? Math.round((done / total) * 100) : 0
              return (
                <button key={k.id} type="button" onClick={onOpenTasks} style={{ borderTopColor: k.colour }}
                  className="flex flex-col gap-2.5 rounded-3xl border-t-8 bg-white p-4 text-left lg:p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={k.name} colour={k.colour} size={36} />
                    <span className="truncate text-xl font-extrabold lg:text-2xl">{k.name}</span>
                  </div>
                  <span className="text-sm font-bold text-muted lg:text-base">
                    {total ? `${done} of ${total} done` : 'No tasks today'} · ★ {board.stars[k.id] ?? 0}
                  </span>
                  <div className="h-3 rounded-full bg-sand"><div style={{ width: `${pct}%`, background: k.colour }} className="h-full rounded-full transition-all" /></div>
                </button>
              )
            })}
            {kids.length === 0 && <p className="col-span-2 font-bold text-faint">No children added yet.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#F2A51A" strokeWidth="2" strokeLinecap="round" className="h-11 w-11 shrink-0 lg:h-16 lg:w-16">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
