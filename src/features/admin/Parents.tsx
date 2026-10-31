import { supabase } from '../../lib/supabase'
import { ageFromBirthdate, type FamilyMember } from '../../lib/types'
import { Avatar } from '../../components/Avatar'

/** Parent area. Sprint 0 shows the family; task editing, approvals and settings land in later sprints. */
export function Parents({ members, familyName }: { members: FamilyMember[]; familyName: string }) {
  return (
    <div className="flex flex-col gap-8 p-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-4xl font-black">{familyName || 'Your family'}</h1>
        <button type="button" onClick={() => void supabase?.auth.signOut()}
          className="rounded-full border-2 border-line bg-white px-5 py-2.5 font-extrabold text-ink-2">Sign out of this screen</button>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => {
          const age = ageFromBirthdate(m.birthdate)
          return (
            <div key={m.id} className="flex items-center gap-4 rounded-3xl bg-white p-5">
              <Avatar name={m.name} colour={m.colour} size={64} />
              <div className="flex flex-col">
                <span className="text-2xl font-extrabold">{m.name}</span>
                <span className="font-bold text-muted">
                  {m.role === 'parent' ? 'Parent' : m.role === 'guest' ? 'Guest' : `Child${age !== null ? `, ${age}` : ''} · ${m.reading_level === 'icons' ? 'icon tiles' : 'reads text'}`}
                </span>
              </div>
            </div>
          )
        })}
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ['Tasks & routines', 'Sprint 3'],
          ['Rewards & surprises', 'Sprint 4'],
          ['Calendar connections', 'Sprint 5'],
        ].map(([title, when]) => (
          <div key={title} className="rounded-3xl border-2 border-dashed border-line p-6">
            <h2 className="text-xl font-extrabold">{title}</h2>
            <p className="font-bold text-faint">Coming in {when}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
