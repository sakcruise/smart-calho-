import { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/** This screen asked itself (mic button), so don't also pop the bubble for the next few seconds. */
let quietUntil = 0
export function quietVoiceBubble() { quietUntil = Date.now() + 15000 }

interface Said { id: string; heard: string | null; reply: string; ok: boolean }

/** When someone talks to the voice assistant, show what it heard and what it did, so kids can see it worked. */
export function VoiceBubble() {
  const [said, setSaid] = useState<Said | null>(null)

  useEffect(() => {
    const client = supabase
    if (!client) return
    let hide: ReturnType<typeof setTimeout> | undefined
    const channel = client
      .channel(`voice:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_log' }, (p) => {
        if (Date.now() < quietUntil) return
        setSaid(p.new as Said)
        clearTimeout(hide)
        hide = setTimeout(() => setSaid(null), 12000)
      })
      .subscribe()
    return () => { clearTimeout(hide); void client.removeChannel(channel) }
  }, [])

  if (!said) return null
  return (
    <div role="status" aria-live="polite" onClick={() => setSaid(null)}
      className="fixed inset-x-4 bottom-28 z-50 mx-auto flex max-w-2xl items-start gap-4 rounded-[28px] bg-ink p-5 text-cream shadow-2xl lg:bottom-32 lg:p-6">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${said.ok ? 'bg-amber text-ink' : 'bg-white/15'}`}><Mic aria-hidden="true" /></span>
      <div className="flex min-w-0 flex-col gap-1">
        {said.heard && <span className="text-base font-bold text-line lg:text-lg">"{said.heard}"</span>}
        <span className="text-xl font-black lg:text-2xl">{said.reply}</span>
      </div>
    </div>
  )
}
