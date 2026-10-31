import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { getSetting } from './lib/settings'
import { useMembers } from './lib/useMembers'
import { SignIn } from './features/admin/SignIn'
import { Setup } from './features/admin/Setup'
import { PinGate } from './features/admin/PinGate'
import { Parents } from './features/admin/Parents'
import { Home } from './features/dashboard/Home'

type Tab = 'home' | 'week' | 'tasks' | 'lists' | 'parents'
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'week', label: 'Week' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'lists', label: 'Lists' },
  { id: 'parents', label: 'Parents' },
]

const DEFAULT_LOCATION = { name: 'Reading, UK', lat: 51.4543, lon: -0.9781 }

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [setupDone, setSetupDone] = useState<boolean | null>(null)
  const [familyName, setFamilyName] = useState('')
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [tab, setTab] = useState<Tab>('home')
  const [unlocked, setUnlocked] = useState(false)
  const { members } = useMembers()

  useEffect(() => {
    if (!supabase) { setSession(null); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    void (async () => {
      setSetupDone(await getSetting<boolean>('setup_complete', false))
      setFamilyName(await getSetting<string>('family_name', ''))
      const loc = await getSetting<{ name: string; lat?: number; lon?: number }>('weather_location', DEFAULT_LOCATION)
      if (loc.lat && loc.lon) setLocation({ name: loc.name, lat: loc.lat, lon: loc.lon })
    })()
  }, [session])

  // Lock the parent area again after 2 minutes idle on it
  useEffect(() => {
    if (!unlocked) return
    const id = setTimeout(() => setUnlocked(false), 2 * 60 * 1000)
    return () => clearTimeout(id)
  }, [unlocked, tab])

  if (session === undefined) return <Splash />
  if (!session) return <SignIn />
  if (setupDone === null) return <Splash />
  if (!setupDone) return <Setup onDone={() => { setSetupDone(true); void getSetting<string>('family_name', '').then(setFamilyName) }} />

  if (tab === 'parents' && !unlocked) {
    return <PinGate parents={members.filter((m) => m.role === 'parent')} onUnlock={() => setUnlocked(true)} onCancel={() => setTab('home')} />
  }

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-auto">
        {tab === 'home' && <Home members={members} familyName={familyName} location={location} />}
        {tab === 'parents' && <Parents members={members} familyName={familyName} />}
        {(tab === 'week' || tab === 'tasks' || tab === 'lists') && <ComingSoon tab={tab} />}
      </main>
      <nav aria-label="Main" className="flex h-28 shrink-0 items-center justify-around bg-white px-10 shadow-[0_-1px_0_#E6DECF]">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
            className={`min-w-44 rounded-[22px] px-7 py-3.5 text-2xl font-extrabold transition ${tab === t.id ? 'bg-amber text-ink' : 'text-ink-2'}`}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Splash() {
  return <div className="flex h-full items-center justify-center bg-ink text-2xl font-extrabold text-cream">Family Smart Calendar</div>
}

function ComingSoon({ tab }: { tab: Tab }) {
  const when = { week: 'Sprint 5 · Family calendar', tasks: 'Sprint 3 · Task board and routines', lists: 'Sprint 2 · Lists and reminders' } as Record<Tab, string>
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <h1 className="text-4xl font-black capitalize">{tab}</h1>
      <p className="text-xl font-bold text-muted">{when[tab]}</p>
    </div>
  )
}
