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
import { Lists } from './features/lists/Lists'
import { ReminderBanner } from './features/reminders/Reminders'
import { TaskBoard } from './features/tasks/TaskBoard'
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
      <ReminderBanner />
      <main className="min-h-0 flex-1 overflow-auto">
        {tab === 'lists' && <Lists members={members} activeMember={members.find((m) => m.role === 'parent') ?? null} />}
        {tab === 'home' && <Home members={members} familyName={familyName} location={location} onOpenTasks={() => setTab('tasks')} />}
        {tab === 'tasks' && <TaskBoard members={members} onGoToParents={() => setTab('parents')} />}
        {tab === 'parents' && <Parents members={members} familyName={familyName} />}
        {tab === 'week' && <ComingSoon tab={tab} />}
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
      <h1 className="text-3xl font-black capitalize lg:text-4xl">{tab}</h1>
      <p className="text-lg font-bold text-muted lg:text-xl">{when[tab]}</p>
    </div>
  )
}
