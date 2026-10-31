import { useEffect, useState } from 'react'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** Night mode: a dim clock on black. Any touch wakes the screen. */
export function IdleScreen({ onWake }: { onWake: () => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id) }, [])
  return (
    <button type="button" onClick={onWake} aria-label="Wake the screen"
      className="fixed inset-0 z-[80] flex cursor-default flex-col items-center justify-center bg-black text-[#5b5348]">
      <span className="text-[clamp(5rem,16vw,14rem)] font-black leading-none tabular-nums">{timeFmt.format(now)}</span>
      <span className="mt-4 text-[clamp(1.25rem,2.6vw,2.25rem)] font-bold">{dateFmt.format(now)}</span>
    </button>
  )
}
