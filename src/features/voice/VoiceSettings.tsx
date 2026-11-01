import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Loader2, Mic, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import haPackage from '../../../public/home-box/config/packages/family_calendar.yaml?raw'

interface VoiceToken { id: string; label: string; created_at: string; last_used_at: string | null }
interface VoiceLog { id: string; heard: string | null; reply: string; ok: boolean; intent: string | null; created_at: string }

const when = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never'

/** Parents: connect Home Assistant's voice assistant to this family, and see what it heard lately. */
export function VoiceSettings() {
  const { rows: tokens } = useTable<VoiceToken>('voice_tokens', 'created_at')
  const { rows: log } = useTable<VoiceLog>('voice_log', 'created_at')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [ready, setReady] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [os, setOs] = useState<'mac' | 'windows'>(() => (/Win/i.test(navigator.userAgent) ? 'windows' : 'mac'))
  const base = `${window.location.origin}/home-box`

  /** One tap: make a pairing code and hand over an installer that already contains it. */
  async function setUpHere() {
    if (!supabase) return
    setError(null); setBusy(true)
    const { data, error: e } = await supabase.rpc('create_home_pairing')
    setBusy(false)
    if (e || !data) { setError(e?.message ?? "Couldn't get the installer ready."); return }
    const code = data as string
    setStartedAt(new Date(Date.now() - 60000).toISOString())
    if (os === 'windows') {
      const cmd = [
        '@echo off',
        'title Home Box setup',
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:PAIR_CODE='${code}'; irm ${base}/install.ps1 | iex"`,
        'echo.',
        'pause',
      ].join('\r\n')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([cmd], { type: 'application/octet-stream' }))
      a.download = 'HomeBox-Setup.cmd'
      document.body.appendChild(a); a.click(); a.remove()
      setReady(code)
    } else {
      const cmd = `curl -fsSL ${base}/install.sh | PAIR_CODE=${code} bash`
      setReady(cmd)
      await copy('cmd', cmd)
    }
  }

  async function makeKey() {
    if (!supabase) return
    setError(null)
    const { data, error: e } = await supabase.rpc('create_voice_token', { token_label: 'Home Assistant' })
    if (e || !data) { setError(e?.message ?? "Couldn't make a key."); return }
    setNewKey(data as string)
  }

  async function copy(what: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 2000) } catch { setCopied(null) }
  }

  const sorted = [...log].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const recent = sorted.filter((l) => l.intent !== 'home_box_ready').slice(0, 6)
  const boxReport = sorted.find((l) => l.intent === 'home_box_ready')
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const justFinished = !!(boxReport && startedAt && boxReport.created_at > startedAt)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-2xl font-black lg:text-3xl"><Mic aria-hidden="true" />Voice</h2>
        <p className="font-bold text-muted">Talk to the wall through Home Assistant: "add milk to the shopping list", "what's on tomorrow", "Ava brushed her teeth", "remind me at 5 to call Granny", "how many stars does Ava have".</p>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border-2 border-amber bg-white p-4 lg:p-6">
        <h3 className="text-xl font-black">Home Box: voice at home</h3>
        <p className="font-bold text-muted">Sets up Home Assistant and a private voice assistant on this computer, already connected to your family. Needs Docker Desktop running. Speech stays on the computer.</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void setUpHere()} disabled={busy}
            className="rounded-full bg-amber px-6 py-4 text-lg font-extrabold disabled:opacity-50">{busy ? 'Getting it ready…' : 'Set up Home Box on this computer'}</button>
          {(['mac', 'windows'] as const).map((o) => (
            <button key={o} type="button" aria-pressed={os === o} onClick={() => { setOs(o); setReady(null) }}
              className={`rounded-full px-3 py-1.5 text-sm font-extrabold ${os === o ? 'bg-ink text-white' : 'border-2 border-line text-ink-2'}`}>{o === 'mac' ? 'Mac / Linux' : 'Windows'}</button>
          ))}
        </div>
        {boxReport && (!ready || justFinished) && (
          <div className={`flex items-start gap-3 rounded-2xl p-4 ${boxReport.ok ? 'bg-green-50 text-green-900' : 'bg-amber/20 text-ink'}`}>
            {boxReport.ok ? <CheckCircle2 className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />}
            <div className="flex flex-col">
              <span className="text-lg font-extrabold">{boxReport.reply}</span>
              <span className="text-sm font-bold opacity-70">Reported {when(boxReport.created_at)}</span>
            </div>
          </div>
        )}
        {ready && !justFinished && (
          <p className="flex items-center gap-2 font-extrabold text-ink-2"><Loader2 className="animate-spin" size={18} aria-hidden="true" />Waiting for your Home Box… this updates by itself when it's done.</p>
        )}
        {ready && !justFinished && (
          <div className="flex flex-col gap-2 rounded-2xl bg-cream p-4">
            {os === 'windows' ? (
              <p className="text-lg font-extrabold">Downloaded <b>HomeBox-Setup.cmd</b>. Open it from your Downloads. If Windows asks, choose <b>More info → Run anyway</b>.</p>
            ) : (
              <p className="text-lg font-extrabold">{copied === 'cmd' ? 'Copied! ' : ''}Open <b>Terminal</b>, paste (⌘V) and press Enter.</p>
            )}
            <p className="font-bold text-muted">It downloads about 2 GB the first time, then says <b>All set</b>. Open <b>localhost:8123</b>, tap the speech bubble and the mic, and say "what's on tomorrow?"</p>
            {os !== 'windows' && (
              <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                <code className="min-w-0 flex-1 select-all break-all text-xs font-bold">{ready}</code>
                <button type="button" onClick={() => void copy('cmd', ready)} className="shrink-0 rounded-full border-2 border-line px-3 py-1 text-sm font-extrabold">{copied === 'cmd' ? 'Copied' : 'Copy'}</button>
              </div>
            )}
            <p className="text-sm font-bold text-faint">This connects to your family once, within 30 minutes.</p>
          </div>
        )}
        {error && <p className="font-bold text-red-700">{error}</p>}
      </div>

      <details className="rounded-3xl border-2 border-dashed border-line">
      <summary className="cursor-pointer p-4 text-lg font-extrabold text-ink-2 lg:px-6">Already run Home Assistant yourself?</summary>
      <div className="flex flex-col gap-3 p-4 pt-0 lg:p-6 lg:pt-0">
        <ol className="list-decimal space-y-1.5 pl-6 font-bold text-ink-2">
          <li>Make a voice key below and copy it.</li>
          <li>In Home Assistant, open the File editor add-on. In <b>secrets.yaml</b> add a line: <code className="rounded bg-cream px-1.5">family_voice_token: </code> followed by the key.</li>
          <li>Tap <b>Copy Home Assistant setup</b> and paste it into a new file <b>packages/family_calendar.yaml</b>.</li>
          <li>In <b>configuration.yaml</b>, under <code className="rounded bg-cream px-1.5">homeassistant:</code>, add <code className="rounded bg-cream px-1.5">packages: !include_dir_named packages</code>, then restart Home Assistant.</li>
          <li>Say "What's on today?" to the speaker. The answer also pops up on the wall.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void makeKey()} className="rounded-full bg-ink px-5 py-3 font-extrabold text-white">Make a voice key</button>
          <button type="button" onClick={() => void copy('setup', haPackage)} className="flex items-center gap-2 rounded-full border-2 border-line px-5 py-3 font-extrabold text-ink-2">
            <Copy size={18} aria-hidden="true" />{copied === 'setup' ? 'Copied' : 'Copy Home Assistant setup'}
          </button>
        </div>
        {newKey && (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-amber bg-cream p-4">
            <span className="font-extrabold">Your voice key: copy it now, it won't be shown again.</span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-xl bg-white px-3 py-2 text-sm">{newKey}</code>
              <button type="button" onClick={() => void copy('key', newKey)} className="shrink-0 rounded-full border-2 border-line bg-white px-3 py-2 font-extrabold">{copied === 'key' ? 'Copied' : 'Copy'}</button>
            </div>
            <span className="text-sm font-bold text-muted">Anyone with this key can add to your lists and tick tasks, so keep it in Home Assistant only.</span>
          </div>
        )}
        {error && <p className="font-bold text-red-700">{error}</p>}
        {tokens.length > 0 && (
          <ul className="flex flex-col gap-2">
            {tokens.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-cream px-4 py-3">
                <span className="flex-1 font-extrabold">{t.label} <span className="font-bold text-muted">· made {when(t.created_at)} · last used {when(t.last_used_at)}</span></span>
                {confirm === t.id
                  ? <button type="button" onClick={() => { void supabase?.from('voice_tokens').delete().eq('id', t.id); setConfirm(null) }} className="rounded-full bg-red-700 px-3 py-1.5 text-sm font-extrabold text-white">Remove key</button>
                  : <button type="button" onClick={() => setConfirm(t.id)} aria-label="Remove this voice key" className="rounded-full border-2 border-line p-2 text-ink-2"><Trash2 size={16} /></button>}
              </li>
            ))}
          </ul>
        )}
      </div>
      </details>

      {recent.length > 0 && (
        <div className="flex flex-col gap-2 rounded-3xl bg-white p-4 lg:p-6">
          <h3 className="text-xl font-black">Recently heard</h3>
          {recent.map((l) => (
            <div key={l.id} className="flex flex-col rounded-2xl bg-cream px-4 py-2.5">
              <span className="text-sm font-bold text-muted">{when(l.created_at)}{l.heard ? ` · "${l.heard}"` : ''}</span>
              <span className={`font-extrabold ${l.ok ? '' : 'text-red-700'}`}>{l.reply}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
