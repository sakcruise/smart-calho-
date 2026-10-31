import { Clock } from './Clock'
import { useWeather } from './useWeather'
import type { FamilyMember } from '../../lib/types'
import { Avatar } from '../../components/Avatar'

interface Props {
  members: FamilyMember[]
  familyName: string
  location: { name: string; lat: number; lon: number }
}

export function Home({ members, familyName, location }: Props) {
  const weather = useWeather(location.lat, location.lon)
  const kids = members.filter((m) => m.role === 'kid')

  return (
    <div className="flex h-full min-h-0">
      <section className="relative flex flex-1 flex-col justify-between bg-sand p-10 lg:p-16">
        <p className="absolute right-6 top-6 text-lg font-extrabold text-faint">{familyName}</p>
        <Clock />
        <div className="flex w-fit items-center gap-6 rounded-[28px] bg-cream px-8 py-5">
          <SunIcon />
          <div className="flex flex-col">
            <span className="text-4xl font-extrabold leading-tight">
              {weather ? `${weather.temp}°` : '—'}{' '}
              <span className="text-2xl font-bold text-muted">{weather ? `${weather.label}, high ${weather.high}° low ${weather.low}°` : 'Fetching weather…'}</span>
            </span>
            <span className="mt-1 text-xl font-bold text-muted">
              {location.name}{weather?.nextRainDay ? ` · rain from ${weather.nextRainDay}` : ''}
            </span>
          </div>
        </div>
      </section>

      <aside className="flex w-[520px] shrink-0 flex-col gap-9 overflow-hidden p-10">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-extrabold uppercase tracking-[0.08em] text-faint">Next up</h2>
          <div className="rounded-3xl border-2 border-dashed border-line p-5 font-bold text-faint">Calendar events appear here in Sprint 5.</div>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-extrabold uppercase tracking-[0.08em] text-faint">Today's tasks</h2>
          <div className="grid grid-cols-2 gap-3">
            {kids.map((k) => (
              <div key={k.id} style={{ borderTopColor: k.colour }} className="flex flex-col gap-2.5 rounded-3xl border-t-8 bg-white p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={k.name} colour={k.colour} size={40} />
                  <span className="text-2xl font-extrabold">{k.name}</span>
                </div>
                <span className="font-bold text-muted">Tasks arrive in Sprint 3</span>
                <div className="h-3 rounded-full bg-sand"><div style={{ width: '0%', background: k.colour }} className="h-full rounded-full" /></div>
              </div>
            ))}
            {kids.length === 0 && <p className="col-span-2 font-bold text-faint">No children added yet.</p>}
          </div>
        </div>
      </aside>
    </div>
  )
}

function SunIcon() {
  return (
    <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#F2A51A" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
