import { useState } from 'react'
import { Copy, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O or 1/I

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
  return `${chars.slice(0, 4)}-${chars.slice(4)}`
}

/** Create a one-time code another parent enters after signing up on their own phone. */
export function InviteParent() {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function create() {
    if (!supabase) return
    setError(null); setCopied(false)
    const c = newCode()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: e } = await supabase.from('household_invites').insert({ code: c, created_by: user?.id ?? null })
    if (e) setError(e.message)
    else setCode(c)
  }

  async function copy() {
    if (!code) return
    try { await navigator.clipboard.writeText(code); setCopied(true) } catch { setCopied(false) }
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-white p-4 lg:p-5">
      <div className="flex items-center gap-3">
        <UserPlus aria-hidden="true" className="shrink-0 text-ink-2" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-extrabold">Invite a parent</span>
          <span className="text-sm font-bold text-muted">They create their own account with this app's link, then enter the code. Works once, for 7 days.</span>
        </div>
        <button type="button" onClick={() => void create()} className="shrink-0 rounded-full bg-amber px-4 py-2.5 font-extrabold">{code ? 'New code' : 'Create code'}</button>
      </div>
      {code && (
        <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
          <span className="flex-1 text-3xl font-black tracking-[0.15em] tabular-nums select-all">{code}</span>
          <button type="button" onClick={() => void copy()} className="flex items-center gap-1.5 rounded-full border-2 border-line bg-white px-3 py-2 font-extrabold text-ink-2"><Copy size={16} aria-hidden="true" />{copied ? 'Copied' : 'Copy'}</button>
        </div>
      )}
      {error && <p className="font-bold text-red-700">{error}</p>}
    </div>
  )
}
