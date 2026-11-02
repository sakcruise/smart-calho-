import { useEffect, useState } from 'react'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export function Clock({ onPhoto = false }: { onPhoto?: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={`relative flex flex-col items-start leading-none ${onPhoto ? 'text-white/75 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]' : ''}`}>
      <span className="text-[clamp(4rem,14vw,12rem)] font-extrabold tabular-nums tracking-tight">
        {timeFmt.format(now)}
      </span>
      <span className={`mt-4 text-[clamp(1.25rem,3vw,2.5rem)] ${onPhoto ? 'font-bold text-white/80' : 'text-muted'}`}>
        {dateFmt.format(now)}
      </span>
    </div>
  )
}
