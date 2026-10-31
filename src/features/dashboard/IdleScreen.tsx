import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import { useWeather } from './useWeather'

interface Photo { id: string; storage_path: string; created_at: string }

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** Signed URLs for the family photos, refreshed hourly; shuffled once per load. */
function usePhotoUrls() {
  const { rows } = useTable<Photo>('photos', 'created_at', false)
  const [urls, setUrls] = useState<string[]>([])
  const paths = useMemo(() => rows.map((r) => r.storage_path).sort(() => Math.random() - 0.5), [rows])
  useEffect(() => {
    if (!supabase || paths.length === 0) { setUrls([]); return }
    let cancelled = false
    const load = async () => {
      const { data } = await supabase!.storage.from('photos').createSignedUrls(paths, 3600)
      if (!cancelled) setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[])
    }
    void load()
    const id = setInterval(() => void load(), 50 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [paths])
  return urls
}

/**
 * Full-screen idle view: rolling family photos with the clock, or a dim clock at night.
 * Any touch dismisses it.
 */
export function IdleScreen({ night, location, onWake }: { night: boolean; location: { name: string; lat: number; lon: number }; onWake: () => void }) {
  const urls = usePhotoUrls()
  const weather = useWeather(location.lat, location.lon)
  const [now, setNow] = useState(() => new Date())
  const [index, setIndex] = useState(0)

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (night || urls.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % urls.length), 12000)
    return () => clearInterval(id)
  }, [night, urls.length])

  if (night) {
    return (
      <button type="button" onClick={onWake} aria-label="Wake the screen"
        className="fixed inset-0 z-[80] flex cursor-default flex-col items-center justify-center bg-black text-[#5b5348]">
        <span className="text-[clamp(5rem,16vw,14rem)] font-black leading-none tabular-nums">{timeFmt.format(now)}</span>
        <span className="mt-4 text-[clamp(1.25rem,2.6vw,2.25rem)] font-bold">{dateFmt.format(now)}</span>
      </button>
    )
  }

  return (
    <button type="button" onClick={onWake} aria-label="Back to the home screen" className="fixed inset-0 z-[80] cursor-default overflow-hidden bg-sand text-left">
      <style>{`
        @keyframes fsc-kb { from { transform: scale(1.02) translate(0,0) } to { transform: scale(1.12) translate(-2%, -1.5%) } }
        @media (prefers-reduced-motion: reduce) { .fsc-kb { animation: none !important } }
      `}</style>
      {urls.map((u, i) => (
        <img key={u} src={u} alt="" aria-hidden="true" className="fsc-kb absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms]"
          style={{ opacity: i === index ? 1 : 0, animation: i === index ? 'fsc-kb 13s ease-out forwards' : 'none' }} />
      ))}
      {urls.length > 0 && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />}
      <div className={`absolute bottom-6 left-6 flex flex-col lg:bottom-14 lg:left-16 ${urls.length ? 'text-white' : 'text-ink'}`}>
        <span className="text-[clamp(4.5rem,12vw,11rem)] font-black leading-none tabular-nums drop-shadow-lg">{timeFmt.format(now)}</span>
        <span className="mt-2 text-[clamp(1.25rem,2.6vw,2.5rem)] font-extrabold drop-shadow">
          {dateFmt.format(now)}{weather ? ` · ${weather.temp}° ${weather.label}` : ''}
        </span>
        {urls.length === 0 && <span className="mt-4 text-lg font-bold text-muted">Add family photos in Parents → Photos and they'll show here.</span>}
      </div>
    </button>
  )
}
