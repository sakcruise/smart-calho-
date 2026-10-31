import { useEffect, useState } from 'react'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-start leading-none">
      <span className="text-[clamp(4rem,14vw,12rem)] font-extrabold tabular-nums tracking-tight">
        {timeFmt.format(now)}
      </span>
      <span className="mt-4 text-[clamp(1.25rem,3vw,2.5rem)] text-[var(--muted)]">
        {dateFmt.format(now)}
      </span>
    </div>
  )
}
