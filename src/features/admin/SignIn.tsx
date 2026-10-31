import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

/** Parent account sign-in. The wall screen signs in once and stays signed in. */
export function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setError(null); setNotice(null)
    const result = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) { setError(result.error.message); return }
    if (mode === 'up' && !result.data.session) {
      setNotice('Account created. Check your email to confirm it, then sign in.')
      setMode('in')
    }
  }

  if (!supabase) {
    return (
      <Shell title="Not connected">
        <p className="text-muted text-lg leading-relaxed">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code> and restart.
        </p>
      </Shell>
    )
  }

  return (
    <Shell title={mode === 'in' ? 'Parent sign-in' : 'Create the parent account'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Email</span>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl border-2 border-line bg-cream px-4 py-3 text-lg font-bold" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Password</span>
          <input id="password" type="password" required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border-2 border-line bg-cream px-4 py-3 text-lg font-bold" />
        </label>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 font-bold text-red-800">{error}</p>}
        {notice && <p className="rounded-2xl bg-sand px-4 py-3 font-bold text-ink-2">{notice}</p>}
        <button type="submit" disabled={busy}
          className="mt-2 rounded-full bg-amber px-6 py-4 text-lg font-extrabold text-ink disabled:opacity-60">
          {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null) }}
          className="text-base font-bold text-muted underline-offset-4 hover:underline">
          {mode === 'in' ? 'First time here? Create the parent account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </Shell>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-ink p-6">
      <div className="w-full max-w-md rounded-[32px] bg-cream p-8 shadow-2xl">
        <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.1em] text-amber-deep">Family Smart Calendar</p>
        <h1 className="mb-6 text-3xl font-black">{title}</h1>
        {children}
      </div>
    </div>
  )
}
