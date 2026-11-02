import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { hashPin } from '../../lib/pin'
import { setSetting } from '../../lib/settings'
import { MEMBER_COLOURS, ageFromBirthdate, defaultReadingLevel, type Role } from '../../lib/types'
import { Avatar } from '../../components/Avatar'

interface Draft {
  name: string
  role: Role
  birthdate: string
  colour: string
}

const STEPS = ['Family name', 'Add members', 'Parent PIN', 'Done'] as const

/** First-run wizard. Writes family_members and settings, then marks setup_complete. */
export function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [familyName, setFamilyName] = useState('')
  const [members, setMembers] = useState<Draft[]>([])
  const [draft, setDraft] = useState<Draft>({ name: '', role: 'kid', birthdate: '', colour: MEMBER_COLOURS[0] })
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const hasParent = members.some((m) => m.role === 'parent')
  const draftAge = ageFromBirthdate(draft.birthdate || null)

  function addMember(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    setMembers([...members, { ...draft, name: draft.name.trim() }])
    const next = MEMBER_COLOURS[(members.length + 1) % MEMBER_COLOURS.length]
    setDraft({ name: '', role: 'kid', birthdate: '', colour: next })
  }

  async function finish() {
    if (!supabase) return
    if (pin.length < 4 || pin !== pin2) { setError('PINs must match and be at least 4 digits.'); return }
    setBusy(true); setError(null)
    const pin_hash = await hashPin(pin)
    const rows = members.map((m, i) => {
      const age = ageFromBirthdate(m.birthdate || null)
      return {
        name: m.name,
        role: m.role,
        colour: m.colour,
        birthdate: m.birthdate || null,
        reading_level: defaultReadingLevel(age),
        pin_hash: m.role === 'parent' ? pin_hash : null,
        sort_order: i,
      }
    })
    const { error: insErr } = await supabase.from('family_members').insert(rows)
    if (insErr) { setBusy(false); setError(insErr.message); return }
    await setSetting('family_name', familyName.trim())
    await setSetting('setup_complete', true)
    setBusy(false)
    setStep(3)
  }

  return (
    <div className="flex h-full flex-col bg-ink lg:flex-row">
      <aside className="flex flex-col justify-between gap-8 p-8 text-cream lg:w-[480px] lg:p-14">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-extrabold uppercase tracking-[0.1em] text-amber">Welcome</p>
          <h1 className="text-4xl font-black leading-tight lg:text-5xl">Let's set up your family hub</h1>
          <p className="text-lg font-bold text-line">You can change any of this later from the Parents screen.</p>
        </div>
        <ol className="flex flex-col gap-4">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex items-center gap-4 text-xl font-extrabold ${i === step ? 'text-cream' : 'text-faint'}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-full text-base ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-amber text-ink' : 'border-2 border-faint'}`}>
                {i < step ? '✓' : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
      </aside>

      <main className="flex flex-1 flex-col gap-6 overflow-auto bg-cream p-8 lg:rounded-l-[40px] lg:p-14">
        {step === 0 && (
          <>
            <h2 className="text-3xl font-black">What's your family called?</h2>
            <p className="text-lg font-bold text-muted">It shows on the home screen, like "The Rajappas".</p>
            <input id="family-name" autoFocus value={familyName} onChange={(e) => setFamilyName(e.target.value)}
              placeholder="The …" className="max-w-md rounded-2xl border-2 border-line bg-white px-5 py-4 text-2xl font-bold" />
            <div className="mt-auto flex justify-end">
              <button type="button" disabled={!familyName.trim()} onClick={() => setStep(1)}
                className="rounded-full bg-ink px-9 py-4 text-xl font-extrabold text-white disabled:opacity-40">Next: add members</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-3xl font-black">Who's in the family?</h2>
              <p className="font-bold text-muted">Age sets how each person's task board looks</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {members.map((m, i) => {
                const age = ageFromBirthdate(m.birthdate || null)
                return (
                  <div key={i} className="flex items-center gap-4 rounded-3xl bg-white p-5">
                    <Avatar name={m.name} colour={m.colour} size={64} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-2xl font-extrabold">{m.name}</span>
                      <span className="font-bold text-muted">
                        {m.role === 'parent' ? 'Parent · can approve tasks' : m.role === 'guest' ? 'Guest · view only' : `Child${age !== null ? `, ${age}` : ''} · ${defaultReadingLevel(age) === 'icons' ? 'icon tiles' : 'reads text'}`}
                      </span>
                    </div>
                    <button type="button" onClick={() => setMembers(members.filter((_, j) => j !== i))}
                      className="rounded-full border-2 border-line bg-white px-4 py-2 font-extrabold text-ink-2">Remove</button>
                  </div>
                )
              })}
              <form onSubmit={addMember} className="flex flex-col gap-4 rounded-3xl border-[3px] border-amber bg-white p-6">
                <h3 className="text-xl font-extrabold">New member</h3>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-extrabold text-muted">Name</span>
                  <input id="m-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="rounded-2xl border-2 border-line bg-cream px-4 py-3 text-xl font-bold" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-extrabold text-muted">Role</span>
                    <select id="m-role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
                      className="rounded-2xl border-2 border-line bg-cream px-4 py-3 text-lg font-bold">
                      <option value="kid">Child</option>
                      <option value="parent">Parent</option>
                      <option value="guest">Guest</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-extrabold text-muted">Date of birth</span>
                    <input id="m-dob" type="date" value={draft.birthdate} onChange={(e) => setDraft({ ...draft, birthdate: e.target.value })}
                      className="rounded-2xl border-2 border-line bg-cream px-4 py-3 text-lg font-bold" />
                  </label>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-extrabold text-muted">Colour</span>
                  <div className="flex flex-wrap gap-2.5">
                    {MEMBER_COLOURS.map((c) => (
                      <button key={c} type="button" aria-label={c} onClick={() => setDraft({ ...draft, colour: c })}
                        style={{ background: c, borderColor: draft.colour === c ? '#1D1F24' : 'transparent' }}
                        className="h-11 w-11 rounded-full border-4" />
                    ))}
                  </div>
                </div>
                {draft.role === 'kid' && draftAge !== null && (
                  <p className="rounded-2xl bg-sky-100 px-4 py-3 font-bold text-sky-900">
                    Age {draftAge}: {draftAge < 7 ? 'tiles show big icons with one word, and completed tasks go to a parent to approve.' : 'tiles show text and star values.'}
                  </p>
                )}
                <button type="submit" disabled={!draft.name.trim()}
                  className="rounded-full bg-amber px-6 py-3.5 text-lg font-extrabold text-ink disabled:opacity-40">
                  Add {draft.name.trim() || 'member'}
                </button>
              </form>
            </div>
            {!hasParent && members.length > 0 && <p className="font-bold text-amber-deep">Add at least one parent before continuing.</p>}
            <div className="mt-auto flex justify-between">
              <button type="button" onClick={() => setStep(0)} className="rounded-full border-2 border-line bg-white px-7 py-4 text-xl font-extrabold text-ink-2">Back</button>
              <button type="button" disabled={!hasParent} onClick={() => setStep(2)}
                className="rounded-full bg-ink px-9 py-4 text-xl font-extrabold text-white disabled:opacity-40">Next: parent PIN</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-3xl font-black">Choose a parent PIN</h2>
            <p className="max-w-lg text-lg font-bold text-muted">Parents enter this on the wall screen to add tasks, approve them and change settings. Kids never need it.</p>
            <div className="grid max-w-md gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-extrabold text-muted">PIN (4–6 digits)</span>
                <input id="pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="rounded-2xl border-2 border-line bg-white px-5 py-4 text-3xl font-black tracking-[0.5em]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-extrabold text-muted">Repeat PIN</span>
                <input id="pin2" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
                  className="rounded-2xl border-2 border-line bg-white px-5 py-4 text-3xl font-black tracking-[0.5em]" />
              </label>
            </div>
            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800">{error}</p>}
            <div className="mt-auto flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="rounded-full border-2 border-line bg-white px-7 py-4 text-xl font-extrabold text-ink-2">Back</button>
              <button type="button" disabled={busy || pin.length < 4} onClick={finish}
                className="rounded-full bg-ink px-9 py-4 text-xl font-extrabold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Finish setup'}</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-3xl font-black">{familyName} is ready</h2>
            <p className="max-w-lg text-lg font-bold text-muted">The home screen shows the clock, date and weather now. Tasks, lists and the calendar arrive in the next sprints; connecting Google and Microsoft calendars comes with the calendar sprint.</p>
            <div className="mt-auto flex justify-end">
              <button type="button" onClick={onDone} className="rounded-full bg-amber px-9 py-4 text-xl font-extrabold text-ink">Go to the home screen</button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
