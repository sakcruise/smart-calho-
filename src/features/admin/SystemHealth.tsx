import { useState } from 'react'
import { Download, HardDrive, Monitor, Smartphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import { InviteParent } from './InviteParent'

interface Device { id: string; name: string; kind: string; app_version: string | null; last_seen_at: string }
interface AppError { id: string; device_id: string | null; message: string; created_at: string }

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** Devices, recent errors, backups and household access. */
export function SystemHealth() {
  const { rows: devices } = useTable<Device>('devices', 'last_seen_at', false)
  const { rows: errors } = useTable<AppError>('app_errors', 'created_at', false)
  const [msg, setMsg] = useState<string | null>(null)

  async function download() {
    if (!supabase) return
    setMsg('Preparing backup…')
    await supabase.rpc('take_backup')
    const { data, error } = await supabase.from('backups').select('taken_at, data').order('taken_at', { ascending: false }).limit(1).maybeSingle()
    if (error || !data) { setMsg("Couldn't make a backup right now."); return }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `family-calendar-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg('Backup downloaded. Keep a copy somewhere safe, like your Google Drive.')
  }

  const stale = (iso: string) => Date.now() - new Date(iso).getTime() > 15 * 60000

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-black lg:text-3xl">System health</h2>
      <InviteParent />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-3xl bg-white p-4 lg:p-5">
          <span className="text-lg font-extrabold">Screens</span>
          {devices.length === 0 && <p className="font-bold text-faint">No screens have checked in yet.</p>}
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              {d.kind === 'wall' ? <Monitor aria-hidden="true" className="shrink-0 text-ink-2" /> : <Smartphone aria-hidden="true" className="shrink-0 text-ink-2" />}
              <span className="min-w-0 flex-1 truncate font-bold">{d.name}</span>
              <span className={`shrink-0 text-sm font-extrabold ${stale(d.last_seen_at) && d.kind === 'wall' ? 'text-red-700' : 'text-muted'}`}>
                {stale(d.last_seen_at) && d.kind === 'wall' ? 'Not seen ' : 'Seen '}{ago(d.last_seen_at)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 rounded-3xl bg-white p-4 lg:p-5">
          <span className="text-lg font-extrabold">Backups</span>
          <p className="flex items-start gap-2 font-bold text-muted"><HardDrive aria-hidden="true" size={20} className="mt-0.5 shrink-0" />Automatic every night at 02:30; the last 14 are kept.</p>
          <button type="button" onClick={() => void download()} className="flex items-center gap-2 self-start rounded-full border-2 border-line px-4 py-2.5 font-extrabold text-ink-2">
            <Download aria-hidden="true" size={18} />Download a backup now
          </button>
          {msg && <p className="text-sm font-bold text-muted">{msg}</p>}
        </div>
      </div>
      <details className="rounded-3xl bg-white p-4 lg:p-5">
        <summary className="cursor-pointer text-lg font-extrabold">Recent problems ({errors.length})</summary>
        <div className="mt-3 flex max-h-72 flex-col gap-1.5 overflow-auto">
          {errors.length === 0 && <p className="font-bold text-faint">Nothing reported.</p>}
          {errors.slice(0, 50).map((e) => (
            <div key={e.id} className="flex gap-3 rounded-xl bg-cream px-3 py-2 text-sm">
              <span className="w-24 shrink-0 font-bold text-muted">{ago(e.created_at)}</span>
              <span className="min-w-0 flex-1 break-words font-bold">{e.message}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
