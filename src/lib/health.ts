import { supabase } from './supabase'

const APP_VERSION = '0.6.0'

export function deviceId(): string {
  try {
    let id = localStorage.getItem('fsc_device_id')
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('fsc_device_id', id) }
    return id
  } catch { return 'unknown' }
}

/** The big landscape screen is the wall; anything narrower is treated as a phone. */
export function deviceKind(): 'wall' | 'phone' {
  return window.innerWidth >= 1200 && window.innerHeight >= 700 ? 'wall' : 'phone'
}

function deviceName() {
  const ua = navigator.userAgent
  if (deviceKind() === 'wall') return 'Wall screen'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return 'Android phone'
  if (/iPad/.test(ua)) return 'iPad'
  return 'Browser'
}

export async function heartbeat() {
  if (!supabase || !navigator.onLine) return
  await supabase.from('devices').upsert({
    id: deviceId(), name: deviceName(), kind: deviceKind(), app_version: APP_VERSION,
    user_agent: navigator.userAgent.slice(0, 300), last_seen_at: new Date().toISOString(),
  })
}

let sent: number[] = []
/** Report an error to the health panel; at most 10 per hour per device so a loop can't flood it. */
export function logError(message: string, detail?: string) {
  const now = Date.now()
  sent = sent.filter((t) => now - t < 3600000)
  if (sent.length >= 10 || !supabase || !navigator.onLine) return
  sent.push(now)
  void supabase.from('app_errors').insert({ device_id: deviceId(), message: message.slice(0, 500), detail: detail?.slice(0, 4000) ?? null }).then(() => undefined)
}

/** Global error capture, heartbeat every 5 minutes, and a fresh reload of the wall each night. */
export function startHealth() {
  window.addEventListener('error', (e) => logError(e.message || 'Error', e.error?.stack))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    logError(r?.message ?? String(r), r?.stack)
  })
  // A new deploy can leave an old tab asking for files that no longer exist: reload once to pick up the new build
  window.addEventListener('vite:preloadError', () => window.location.reload())

  void heartbeat()
  const hb = setInterval(() => void heartbeat(), 5 * 60 * 1000)

  // The wall reloads itself at about 03:30 each night to start the day fresh
  const nightly = setInterval(() => {
    const d = new Date()
    if (deviceKind() === 'wall' && d.getHours() === 3 && d.getMinutes() >= 30 && d.getMinutes() < 35) window.location.reload()
  }, 5 * 60 * 1000)
  return () => { clearInterval(hb); clearInterval(nightly) }
}
