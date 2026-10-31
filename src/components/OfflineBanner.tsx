import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="flex items-center gap-3 bg-ink px-4 py-2.5 text-cream lg:px-10">
      <WifiOff aria-hidden="true" size={22} className="shrink-0 text-amber" />
      <span className="text-sm font-extrabold lg:text-lg">Offline. Showing the last saved information; ticks and changes need the internet back.</span>
    </div>
  )
}
