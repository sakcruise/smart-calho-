import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { getSetting } from './lib/settings'
import { useMembers } from './lib/useMembers'
import { SignIn } from './features/admin/SignIn'
import { Setup } from './features/admin/Setup'
import { PinGate } from './features/admin/PinGate'
import { Parents } from './features/admin/Parents'
import { Home } from './features/dashboard/Home'
import { Lists } from './features/lists/Lists'
import { ReminderBanner } from './features/reminders/Reminders'
import { TaskBoard } from './features/tasks/TaskBoard'
import { Calendar } from './features/calendar/Calendar'
import { syncCalendarsIfStale } from './features/calendar/useEvents'
import { JoinHousehold } from './features/admin/JoinHousehold'
import { IdleScreen } from './features/dashboard/IdleScreen'
import { OfflineBanner } from './components/OfflineBanner'
import { cacheGet, cacheSet } from './lib/cache'
import { deviceKind } from './lib/health'
import { CalendarDays, Home as HomeIcon, ListChecks, Lock, Star } from 'lucide-react'

type Tab = 'home' | 'week' | 'tasks' | 'lists' | 'parents'
const TABS: { id: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'week', label: 'Week', Icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', Icon: Star },
  { id: 'lists', label: 'Lists', Icon: ListChecks },
  { id: 'parents', label: 'Parents', Icon: Lock },
]

const DEFAULT_LOCATION = { name: 'Reading, UK', lat: 51.4543, lon: -0.9781 }

/** Is the time inside quiet hours? Handles windows that cross midnight (21:00 to 06:30). */
function inQuietHours(now: Date, q: { start: string; end: string }) {
  const m = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = q.start.split(':').map(Number), [eh, em] = q.end.split(':').map(Number)
  const s = sh * 60 + sm, e = eh * 60 + em
  return s <= e ? m >= s && m < e : m >= s || m < e
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [setupDone, setSetupDone] = useState<boolean | null>(null)
  const [familyName, setFamilyName] = useState('')
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [tab, setTab] = useState<Tab>(() => {
    // A notification can open the app straight on a tab (?tab=parents)
    const t = new URLSearchParams(window.location.search).get('tab')
    return (['home', 'week', 'tasks', 'lists', 'parents'] as Tab[]).includes(t as Tab) ? (t as Tab) : 'home'
  })
  const [unlocked, setUnlocked] = useState(false)
  const [pinFor, setPinFor] = useState<(() => void) | null>(null)
  const [member, setMember] = useState<boolean | null>(null)
  const [idleMinutes, setIdleMinutes] = useState(2)
  const [quiet, setQuiet] = useState({ start: '21:00', end: '06:30' })
  const [idle, setIdle] = useState(false)
  const [photosOn, setPhotosOn] = useState(() => cacheGet<boolean>('home_photos') ?? false)
  const togglePhotos = useCallback(() => setPhotosOn((on) => { cacheSet('home_photos', !on); return !on }), [])
  const [night, setNight] = useState(false)
  const lastActivity = useRef(Date.now())
  const [settingsVersion, setSettingsVersion] = useState(0)
  const { members } = useMembers()
  const unlockedRef = useRef(unlocked)
  unlockedRef.current = unlocked

  /** Run fn straight away if a parent is unlocked, otherwise after the PIN is entered. */
  const requireParent = useCallback((fn: () => void) => {
    if (unlockedRef.current) fn()
    else setPinFor(() => fn)
  }, [])

  useEffect(() => {
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Is this account part of the household? (Offline: trust the last answer.)
  useEffect(() => {
    if (!session || !supabase) return
    void (async () => {
      const { data, error } = await supabase!.rpc('is_household_member')
      if (error) { setMember(cacheGet<boolean>('member') ?? true); return }
      setMember(data === true); cacheSet('member', data === true)
    })()
  }, [session])

  useEffect(() => {
    if (!session || !member) return
    void (async () => {
      setIdleMinutes(Number(await getSetting<number>('idle_timeout_minutes', 2)) || 2)
      setQuiet(await getSetting<{ start: string; end: string }>('quiet_hours', { start: '21:00', end: '06:30' }))
      setSetupDone(await getSetting<boolean>('setup_complete', false))
      setFamilyName(await getSetting<string>('family_name', ''))
      const loc = await getSetting<{ name: string; lat?: number; lon?: number }>('weather_location', DEFAULT_LOCATION)
      if (loc.lat && loc.lon) setLocation({ name: loc.name, lat: loc.lat, lon: loc.lon })
    })()
  }, [session, member, settingsVersion])

  // Wall only: after a spell untouched, go back Home, lock the parent area and show photos (or the night clock)
  useEffect(() => {
    if (deviceKind() !== 'wall') return
    const touch = () => { lastActivity.current = Date.now() }
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, touch, { passive: true })
    const id = setInterval(() => {
      const isNight = inQuietHours(new Date(), quiet)
      setNight(isNight)
      const limit = (isNight ? 1 : idleMinutes) * 60000
      if (Date.now() - lastActivity.current > limit) {
        // Untouched: back to Home with photos rolling behind the clock (night: dim clock instead)
        setTab('home'); setUnlocked(false); setPinFor(null)
        if (isNight) setIdle(true)
        else setPhotosOn(true)
      }
    }, 15000)
    return () => {
      clearInterval(id)
      for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(ev, touch)
    }
  }, [idleMinutes, quiet])

  // Keep the wall's screen awake (where the browser allows it)
  useEffect(() => {
    if (deviceKind() !== 'wall' || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    const get = async () => { try { lock = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen') } catch { /* not allowed */ } }
    void get()
    const onVis = () => { if (document.visibilityState === 'visible') void get() }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release() }
  }, [])

  // Keep connected calendars fresh: on start, then every 15 minutes
  useEffect(() => {
    if (!session || !setupDone) return
    void syncCalendarsIfStale()
    const id = setInterval(() => void syncCalendarsIfStale(), 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [session, setupDone])

  // Lock the parent area again after 2 minutes idle on it
  useEffect(() => {
    if (!unlocked) return
    const id = setTimeout(() => setUnlocked(false), 2 * 60 * 1000)
    return () => clearTimeout(id)
  }, [unlocked, tab])

  if (session === undefined) return <Splash />
  if (!session) return <SignIn />
  if (member === null) return <Splash />
  if (!member) return <JoinHousehold onJoined={() => { setMember(true); cacheSet('member', true) }} />
  if (setupDone === null) return <Splash />
  if (!setupDone) return <Setup onDone={() => { setSetupDone(true); void getSetting<string>('family_name', '').then(setFamilyName) }} />

  if (tab === 'parents' && !unlocked) {
    return <PinGate parents={members.filter((m) => m.role === 'parent')} onUnlock={() => setUnlocked(true)} onCancel={() => setTab('home')} />
  }

  return (
    <div className="flex h-full flex-col">
      <OfflineBanner />
      <ReminderBanner />
      <main className="min-h-0 flex-1 overflow-auto">
        {tab === 'lists' && <Lists members={members} activeMember={members.find((m) => m.role === 'parent') ?? null} />}
        {tab === 'home' && <Home members={members} familyName={familyName} location={location} onOpenTasks={() => setTab('tasks')} photosOn={photosOn} onTogglePhotos={togglePhotos} />}
        {tab === 'tasks' && <TaskBoard members={members} onGoToParents={() => setTab('parents')} />}
        {tab === 'parents' && <Parents members={members} familyName={familyName} onSettingsChanged={() => setSettingsVersion((v) => v + 1)} />}
        {tab === 'week' && <Calendar members={members} requireParent={requireParent} />}
      </main>
      <nav aria-label="Main" className="flex shrink-0 items-stretch justify-around gap-1 bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-1px_0_#E6DECF] lg:h-28 lg:items-center lg:px-10 lg:py-0">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-1.5 text-xs font-extrabold transition lg:min-w-44 lg:flex-none lg:flex-row lg:justify-center lg:gap-3 lg:rounded-[22px] lg:px-7 lg:py-3.5 lg:text-2xl ${tab === t.id ? 'bg-amber text-ink' : 'text-ink-2'}`}>
            <t.Icon aria-hidden="true" className="h-6 w-6 lg:h-7 lg:w-7" strokeWidth={2.3} />
            {t.label}
          </button>
        ))}
      </nav>
      {idle && night && <IdleScreen onWake={() => { setIdle(false); lastActivity.current = Date.now() }} />}
      {pinFor && (
        <div className="fixed inset-0 z-50">
          <PinGate parents={members.filter((m) => m.role === 'parent')}
            onUnlock={() => { setUnlocked(true); const fn = pinFor; setPinFor(null); fn() }}
            onCancel={() => setPinFor(null)} />
        </div>
      )}
    </div>
  )
}

function Splash() {
  return <div className="flex h-full items-center justify-center bg-ink text-2xl font-extrabold text-cream">Family Smart Calendar</div>
}
