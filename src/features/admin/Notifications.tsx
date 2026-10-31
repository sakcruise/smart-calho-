import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { FamilyMember } from '../../lib/types'

const VAPID_PUBLIC = 'BGJMhMQpCavQGwB8wTRaTg_pBCrC9rg6H_rypGOhrrxVT3c1njunEQ9TQBjDBxXLLKFNGL1yBVQYEg6L5moCQFg'

function keyBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Turn on phone notifications for reminders and approvals, on this device only. */
export function Notifications({ members }: { members: FamilyMember[] }) {
  const parents = members.filter((m) => m.role === 'parent')
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const [sub, setSub] = useState<PushSubscription | null>(null)
  const [owner, setOwner] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    void navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then(setSub)
  }, [supported])
  useEffect(() => { if (!owner && parents[0]) setOwner(parents[0].id) }, [owner, parents])

  async function enable() {
    if (!supabase) return
    setBusy(true); setMsg(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setMsg('Notifications are blocked for this site. Allow them in your phone or browser settings, then try again.'); return }
      const reg = await navigator.serviceWorker.ready
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) })
      const j = s.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('push_subscriptions').upsert({
        endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: user?.id ?? null,
        member_id: owner || null, device_name: isIos() ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Browser',
      })
      if (error) { setMsg(error.message); return }
      setSub(s)
      await supabase.functions.invoke('notify', { body: { test: true } })
      setMsg('On. A test notification is on its way.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not turn notifications on.')
    } finally { setBusy(false) }
  }

  async function disable() {
    if (!sub || !supabase) return
    setBusy(true)
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
    setSub(null); setBusy(false); setMsg('Off on this phone.')
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-black lg:text-3xl">Phone notifications</h2>
      <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 lg:p-6">
        <p className="font-bold text-muted">Get reminders and "task waiting for approval" on this phone, even when the app is closed. Turn it on separately on each parent's phone.</p>
        {!supported && isIos() && !isInstalled() ? (
          <ol className="list-decimal space-y-1 pl-6 font-bold text-ink-2">
            <li>On iPhone, notifications need the app on your home screen first.</li>
            <li>In Safari, tap Share, then <b>Add to Home Screen</b>.</li>
            <li>Open the app from the new icon, come back here and turn notifications on.</li>
          </ol>
        ) : !supported ? (
          <p className="font-bold text-red-700">This browser doesn't support notifications. Try Chrome, or Safari from the home screen on iPhone.</p>
        ) : sub ? (
          <div className="flex flex-wrap items-center gap-3">
            <Bell aria-hidden="true" className="text-green-700" />
            <span className="flex-1 font-extrabold">On for this phone</span>
            <button type="button" onClick={() => void supabase?.functions.invoke('notify', { body: { test: true } }).then(() => setMsg('Test sent.'))}
              className="rounded-full border-2 border-line px-4 py-2.5 font-extrabold text-ink-2">Send a test</button>
            <button type="button" disabled={busy} onClick={() => void disable()} className="flex items-center gap-1.5 rounded-full border-2 border-line px-4 py-2.5 font-extrabold text-ink-2">
              <BellOff aria-hidden="true" size={18} />Turn off
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-extrabold">
              This phone belongs to
              <select id="push-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="rounded-2xl border-2 border-line bg-cream px-3 py-2 font-bold">
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy} onClick={() => void enable()} className="flex items-center gap-2 rounded-full bg-amber px-5 py-3 font-extrabold disabled:opacity-50">
              <Bell aria-hidden="true" size={20} />{busy ? 'Turning on…' : 'Turn on notifications'}
            </button>
          </div>
        )}
        {msg && <p className="font-bold text-muted">{msg}</p>}
      </div>
    </section>
  )
}
