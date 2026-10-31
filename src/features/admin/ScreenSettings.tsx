import { useEffect, useState } from 'react'
import { getSetting, setSetting } from '../../lib/settings'

interface Quiet { start: string; end: string }
interface Place { name: string; lat?: number; lon?: number }

/** Idle timeout, quiet hours (night mode) and the town used for weather. */
export function ScreenSettings({ onSaved }: { onSaved: () => void }) {
  const [idle, setIdle] = useState(2)
  const [quiet, setQuiet] = useState<Quiet>({ start: '21:00', end: '06:30' })
  const [town, setTown] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setIdle(Number(await getSetting<number>('idle_timeout_minutes', 2)) || 2)
      setQuiet(await getSetting<Quiet>('quiet_hours', { start: '21:00', end: '06:30' }))
      const p = await getSetting<Place>('weather_location', { name: 'Reading, UK' })
      setPlace(p); setTown(p.name)
    })()
  }, [])

  async function save() {
    setMsg(null)
    let loc = place
    if (town.trim() && town.trim() !== place?.name) {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(town.trim().split(',')[0])}&count=1&language=en&format=json`)
        const j = await r.json()
        const hit = j.results?.[0]
        if (!hit) { setMsg(`Couldn't find "${town}". Try just the town name.`); return }
        loc = { name: `${hit.name}${hit.country_code ? `, ${hit.country_code}` : ''}`, lat: hit.latitude, lon: hit.longitude }
        setPlace(loc); setTown(loc.name)
      } catch { setMsg('Weather town not saved: no internet.'); return }
    }
    await setSetting('idle_timeout_minutes', Math.max(1, Math.min(60, idle)))
    await setSetting('quiet_hours', quiet)
    if (loc) await setSetting('weather_location', loc)
    setMsg('Saved.')
    onSaved()
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-black lg:text-3xl">Wall screen</h2>
      <div className="grid gap-4 rounded-3xl bg-white p-4 md:grid-cols-3 lg:p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Show photos after (minutes untouched)</span>
          <input id="idle-min" type="number" min={1} max={60} value={idle} onChange={(e) => setIdle(Number(e.target.value))}
            className="rounded-2xl border-2 border-line bg-cream px-4 py-3 text-lg font-bold" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Night mode (dim clock only)</span>
          <div className="flex items-center gap-2">
            <input id="quiet-start" type="time" aria-label="Night mode starts" value={quiet.start} onChange={(e) => setQuiet({ ...quiet, start: e.target.value })}
              className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-cream px-3 py-3 font-bold" />
            <span className="font-bold text-muted">to</span>
            <input id="quiet-end" type="time" aria-label="Night mode ends" value={quiet.end} onChange={(e) => setQuiet({ ...quiet, end: e.target.value })}
              className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-cream px-3 py-3 font-bold" />
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Town for weather</span>
          <input id="weather-town" value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Reading"
            className="rounded-2xl border-2 border-line bg-cream px-4 py-3 text-lg font-bold" />
        </label>
        <div className="flex items-center justify-end gap-3 md:col-span-3">
          {msg && <span className="font-bold text-muted">{msg}</span>}
          <button type="button" onClick={() => void save()} className="rounded-full bg-ink px-6 py-3 font-extrabold text-white">Save</button>
        </div>
      </div>
    </section>
  )
}
