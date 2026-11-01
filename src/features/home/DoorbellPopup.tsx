import { useEffect, useRef, useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface HomeEvent { id: string; kind: string; title: string; camera: string | null; image_path: string | null; created_at: string }

/** Where the Home Box's Home Assistant is, as seen from this screen (the wall runs on the same computer). */
const HA_URL = 'http://localhost:8123'

function dingDong() {
  try {
    const ctx = new AudioContext()
    const note = (freq: number, at: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 1.2)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 1.3)
    }
    note(659, 0); note(523, 0.6)
    setTimeout(() => void ctx.close(), 2500)
  } catch { /* no audio */ }
}

/** Doorbell rings from the Home Box: the front door camera fills the screen with a ding-dong. */
export function DoorbellPopup() {
  const [event, setEvent] = useState<HomeEvent | null>(null)
  const [tick, setTick] = useState(0)
  const [imageOk, setImageOk] = useState(true)
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const client = supabase
    if (!client) return
    const channel = client
      .channel(`home-events:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'home_events' }, (p) => {
        const e = p.new as HomeEvent
        if (Date.now() - Date.parse(e.created_at) > 120000) return
        setEvent(e); setImageOk(true); setTick(0)
        dingDong()
        clearTimeout(hide.current)
        hide.current = setTimeout(() => setEvent(null), 90000)
      })
      .subscribe()
    return () => { clearTimeout(hide.current); void client.removeChannel(channel) }
  }, [])

  // Refresh the camera picture every couple of seconds while it's showing
  useEffect(() => {
    if (!event?.image_path) return
    const id = setInterval(() => setTick((t) => t + 1), 2000)
    return () => clearInterval(id)
  }, [event])

  if (!event) return null
  const src = event.image_path ? `${HA_URL}${event.image_path}${event.image_path.includes('?') ? '&' : '?'}t=${tick}` : null
  const time = new Date(event.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div role="alertdialog" aria-modal="true" aria-label={event.title} onClick={() => setEvent(null)}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-ink/95 p-6 text-cream">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-amber text-ink lg:h-20 lg:w-20"><BellRing className="h-9 w-9 lg:h-11 lg:w-11" aria-hidden="true" /></span>
        <div className="flex flex-col">
          <span className="text-3xl font-black lg:text-5xl">{event.title}</span>
          <span className="text-lg font-bold text-line lg:text-2xl">{event.camera ? `${event.camera} · ` : ''}{time}</span>
        </div>
      </div>
      {src && imageOk && (
        <img src={src} alt={`Live picture from ${event.camera ?? 'the door camera'}`} onError={() => setImageOk(false)}
          className="max-h-[70vh] w-auto max-w-full rounded-3xl object-contain shadow-2xl" />
      )}
      {(!src || !imageOk) && <p className="max-w-xl text-center text-lg font-bold text-line">Open the Eufy app to see who it is.</p>}
      <button type="button" onClick={() => setEvent(null)} className="flex items-center gap-2 rounded-full bg-white/15 px-6 py-3 text-xl font-extrabold">
        <X aria-hidden="true" />Close
      </button>
    </div>
  )
}
