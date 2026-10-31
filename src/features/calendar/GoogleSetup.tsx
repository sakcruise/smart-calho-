import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { getSetting } from '../../lib/settings'
import { GOOGLE_REDIRECT_URI, saveGoogleCredentials } from './google'

/** One-time: paste the Google OAuth client so the wall can add events to Google Calendar. */
export function GoogleSetup() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [id, setId] = useState('')
  const [secret, setSecret] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { void getSetting<boolean>('google_oauth_configured', false).then(setConfigured) }, [])

  async function save() {
    setMsg(null)
    if (!/\.apps\.googleusercontent\.com$/.test(id.trim())) { setMsg('The client ID ends in .apps.googleusercontent.com'); return }
    if (secret.trim().length < 10) { setMsg('Paste the client secret too.'); return }
    const ok = await saveGoogleCredentials(id, secret)
    if (ok) { setConfigured(true); setOpen(false); setId(''); setSecret(''); setMsg('Saved. Now tap "Let the wall add events" on a Google calendar.') }
    else setMsg("Couldn't save. Are you signed in as a parent?")
  }

  if (configured === null) return null
  if (configured && !open) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-4 text-sm font-bold text-muted">
        <span className="flex-1">Google two-way sync is set up. Each Google calendar below needs its owner to tap "Let the wall add events" once.</span>
        <button type="button" onClick={() => setOpen(true)} className="rounded-full border-2 border-line px-3 py-1.5 font-extrabold text-ink-2">Change keys</button>
        {msg && <span className="w-full">{msg}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-amber bg-white p-4 lg:p-6">
      <h3 className="text-xl font-black">Let the wall add events to Google (one-time setup, ~10 minutes on a computer)</h3>
      <ol className="list-decimal space-y-1.5 pl-6 font-bold text-ink-2">
        <li>Go to <span className="select-all">console.cloud.google.com</span> and create a project called "Family Calendar".</li>
        <li>APIs &amp; Services → Library → search <b>Google Calendar API</b> → Enable.</li>
        <li>APIs &amp; Services → OAuth consent screen: choose <b>External</b>, app name "Family Calendar", your email for support and contact. Add the scope <b>…/auth/calendar.events</b>. Add your and your wife's Gmail addresses as test users.</li>
        <li>On the consent screen's <b>Audience</b> page, tap <b>Publish app</b> (In production). Otherwise Google signs you out every 7 days. Google will show an "unverified app" warning when you connect; that's expected for a private family app: tap Advanced → Go to Family Calendar.</li>
        <li>Credentials → Create credentials → <b>OAuth client ID</b> → Web application. Under <b>Authorised redirect URIs</b> add:
          <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-cream px-3 py-2">
            <code className="min-w-0 flex-1 break-all text-sm">{GOOGLE_REDIRECT_URI}</code>
            <button type="button" onClick={() => void navigator.clipboard.writeText(GOOGLE_REDIRECT_URI).catch(() => undefined)} aria-label="Copy redirect address" className="shrink-0 rounded-full border-2 border-line p-1.5"><Copy size={16} /></button>
          </div>
        </li>
        <li>Create, then paste the Client ID and Client secret below.</li>
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Client ID</span>
          <input id="g-client-id" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" spellCheck={false} placeholder="…apps.googleusercontent.com"
            className="min-w-0 rounded-2xl border-2 border-line bg-cream px-4 py-3 font-bold" />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-extrabold text-muted">Client secret</span>
          <input id="g-client-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} placeholder="GOCSPX-…"
            className="min-w-0 rounded-2xl border-2 border-line bg-cream px-4 py-3 font-bold" />
        </label>
      </div>
      <p className="text-sm font-bold text-muted">These are stored only on your family's server and can't be read back by the app.</p>
      {msg && <p className="font-bold text-red-700">{msg}</p>}
      <div className="flex justify-end gap-2">
        {configured && <button type="button" onClick={() => setOpen(false)} className="rounded-full border-2 border-line px-5 py-3 font-extrabold text-ink-2">Cancel</button>}
        <button type="button" onClick={() => void save()} className="rounded-full bg-ink px-6 py-3 font-extrabold text-white">Save keys</button>
      </div>
    </div>
  )
}
