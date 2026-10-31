import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

/** Shown to a signed-in account that isn't part of the household yet. */
export function JoinHousehold({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="flex h-full items-center justify-center bg-ink p-6">
      <form onSubmit={join} className="flex w-full max-w-md flex-col gap-4 rounded-[32px] bg-cream p-8 shadow-2xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-amber-deep">Family Smart Calendar</p>
        <h1 className="text-3xl font-black">Join your family</h1>
        <p className="font-bold text-muted">Ask a parent to open Parents → Invite a parent on the wall screen, then type the code here.</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Invite code</span>
          <input id="invite-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" spellCheck={false}
            placeholder="ABCD-1234" className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.2em]" />
        </label>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800">{error}</p>}
        <button type="submit" disabled={busy || !code.trim()} className="rounded-full bg-amber px-6 py-4 text-lg font-extrabold disabled:opacity-50">{busy ? 'Checking…' : 'Join'}</button>
        <button type="button" onClick={() => void supabase?.auth.signOut()} className="font-bold text-muted underline-offset-4 hover:underline">Sign out</button>
      </form>
    </div>
  )
}
