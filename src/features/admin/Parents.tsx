import { supabase } from '../../lib/supabase'
import { ageFromBirthdate, type FamilyMember } from '../../lib/types'
import { Avatar } from '../../components/Avatar'
import { TaskEditor } from '../tasks/TaskEditor'
import { RewardsAdmin } from '../rewards/RewardsAdmin'
import { CalendarConnections } from '../calendar/CalendarConnections'
import { PhotosAdmin } from './PhotosAdmin'
import { ScreenSettings } from './ScreenSettings'
import { SystemHealth } from './SystemHealth'
import { Notifications } from './Notifications'

/** Parent area: approvals and tasks, rewards, calendar connections, then the family. */
export function Parents({ members, familyName, onSettingsChanged }: { members: FamilyMember[]; familyName: string; onSettingsChanged: () => void }) {
  return (
    <div className="flex flex-col gap-8 p-4 lg:gap-10 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black lg:text-4xl">{familyName || 'Your family'}</h1>
        <button type="button" onClick={() => void supabase?.auth.signOut()}
          className="rounded-full border-2 border-line bg-white px-4 py-2 text-sm font-extrabold text-ink-2 lg:px-5 lg:py-2.5 lg:text-base">Sign out of this screen</button>
      </div>

      <TaskEditor members={members} />

      <Notifications members={members} />

      <RewardsAdmin members={members} />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-black lg:text-3xl">Family</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {members.map((m) => {
            const age = ageFromBirthdate(m.birthdate)
            return (
              <div key={m.id} className="flex items-center gap-4 rounded-3xl bg-white p-4">
                <Avatar name={m.name} colour={m.colour} size={52} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xl font-extrabold">{m.name}</span>
                  <span className="text-sm font-bold text-muted">
                    {m.role === 'parent' ? 'Parent' : m.role === 'guest' ? 'Guest' : `Child${age !== null ? `, ${age}` : ''} · ${m.reading_level === 'icons' ? 'icon tiles' : 'reads text'}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <CalendarConnections members={members} />

      <PhotosAdmin />

      <ScreenSettings onSaved={onSettingsChanged} />

      <SystemHealth />
    </div>
  )
}
