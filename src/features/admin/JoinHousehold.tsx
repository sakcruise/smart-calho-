import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

/** Shown to a signed-in account that isn't in a family yet: start a new family, or join one with a code. */
export function JoinHousehold({ onJoined }: { onJoined: () => void }) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !name.trim()) return
    setBusy(true); setError(null)
    const { data, error: rpcError } = await supabase.rpc('create_household', { family_name: name.trim() })
    if (!rpcError && data) await supabase.from('settings').upsert({ key: 'family_name', value: name.trim() }, { onConflict: 'household_id,key' })
    setBusy(false)
    if (rpcError || !data) { setError(rpcError?.message ?? "Couldn't create your family. Try again."); return }
    onJoined()
  }

  async function join(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !code.trim()) return
    setBusy(true); setError(null)
    const { data, error: rpcError } = await supabase.rpc('join_household', { invite_code: code.trim() })
    setBusy(false)
    if (rpcError) { setError(rpcError.message); return }
    if (data === true) onJoined()
    else setError("That code didn't work. Codes can be used once and last 7 days; ask for a new one.")
  }

  const back = (
    <button type="button" onClick={() => { setMode('choose'); setError(null) }} className="font-bold text-muted underline-offset-4 hover:underline">Back</button>
  )

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-ink p-4 sm:p-6">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-[32px] bg-cream p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-amber-deep">Family Smart Calendar</p>

        {mode === 'choose' && (
          <>
            <h1 className="text-3xl font-black">Welcome!</h1>
            <p className="font-bold text-muted">Is this a new family calendar, or are you joining one someone already set up?</p>
            <button type="button" onClick={() => setMode('create')} className="flex flex-col items-start gap-1 rounded-3xl bg-amber px-6 py-5 text-left">
              <span className="text-xl font-black">Start a new family</span>
              <span className="font-bold text-ink-2">Your own private calendar, tasks and photos.</span>
            </button>
            <button type="button" onClick={() => setMode('join')} className="flex flex-col items-start gap-1 rounded-3xl border-2 border-line bg-white px-6 py-5 text-left">
              <span className="text-xl font-black">Join my family</span>
              <span className="font-bold text-muted">I have an invite code from a parent.</span>
            </button>
          </>
        )}

        {mode === 'create' && (
          <form onSubmit={create} className="flex flex-col gap-4">
            <h1 className="text-3xl font-black">Start a new family</h1>
            <p className="font-bold text-muted">Only people you invite can see it. Next you'll add everyone in the family.</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-extrabold text-muted">Family name</span>
              <input id="family-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                placeholder="e.g. The Smiths" className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-xl font-bold" />
            </label>
            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800">{error}</p>}
            <button type="submit" disabled={busy || !name.trim()} className="rounded-full bg-amber px-6 py-4 text-lg font-extrabold disabled:opacity-50">{busy ? 'Creating…' : 'Create my family'}</button>
            {back}
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={join} className="flex flex-col gap-4">
            <h1 className="text-3xl font-black">Join your family</h1>
            <p className="font-bold text-muted">Ask a parent to open Parents → Invite a parent on the wall screen, then type the code here.</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-extrabold text-muted">Invite code</span>
              <input id="invite-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" spellCheck={false}
                placeholder="ABCD-1234" className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.2em]" />
            </label>
            {error && <p className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800">{error}</p>}
            <button type="submit" disabled={busy || !code.trim()} className="rounded-full bg-amber px-6 py-4 text-lg font-extrabold disabled:opacity-50">{busy ? 'Checking…' : 'Join'}</button>
            {back}
          </form>
        )}

        <button type="button" onClick={() => void supabase?.auth.signOut()} className="font-bold text-muted underline-offset-4 hover:underline">Sign out</button>
      </div>
    </div>
  )
}
