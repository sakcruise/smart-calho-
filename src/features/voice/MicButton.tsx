import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Keyboard, Mic, Send, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { quietVoiceBubble } from './VoiceBubble'

// The browser's own speech recognition (Chrome/Android and Safari/iPhone); not in every browser.
type Recognition = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean
  start: () => void; stop: () => void; abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
function makeRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return SR ? new SR() : null
}

function say(text: string) {
  try {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    const voice = synth.getVoices().find((v) => v.lang === 'en-GB')
    if (voice) u.voice = voice
    synth.speak(u)
  } catch { /* no speech on this device */ }
}

const EXAMPLES = ['Add milk to the shopping list', "What's on tomorrow?", 'Ava brushed her teeth', 'Remind me at 5 pm to call Granny', 'How many stars does Ava have?']

type Phase = 'idle' | 'listening' | 'thinking' | 'answered' | 'typing'

/** Tap-to-talk: say a command, it's done on the family calendar and the answer is shown and read out. */
export function MicButton({ examples = EXAMPLES }: { examples?: string[] }) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [heard, setHeard] = useState('')
  const [answer, setAnswer] = useState<{ text: string; ok: boolean } | null>(null)
  const [typed, setTyped] = useState('')
  const rec = useRef<Recognition | null>(null)
  const supported = typeof window !== 'undefined' && !!makeRecognition()

  async function send(text: string) {
    const t = text.trim()
    if (!t || !supabase) return
    setHeard(t); setPhase('thinking'); setAnswer(null)
    quietVoiceBubble()
    const { data, error } = await supabase.functions.invoke('voice', { body: { text: t } })
    let speech = (data as { speech?: string } | null)?.speech
    if (!speech && error) {
      try { speech = (await (error as { context?: Response }).context?.json())?.speech } catch { /* ignore */ }
    }
    const reply = speech ?? "Sorry, I couldn't reach the family calendar. Check the internet and try again."
    setAnswer({ text: reply, ok: !error }); setPhase('answered')
    say(reply)
  }

  function listen() {
    const r = makeRecognition()
    if (!r) { setPhase('typing'); return }
    rec.current?.abort()
    rec.current = r
    r.lang = 'en-GB'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false
    let final = ''
    r.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = text }
      setHeard(text)
    }
    r.onerror = (e) => {
      setPhase('answered')
      setAnswer({ ok: false, text: e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'The microphone is blocked. Allow it for this site in your browser settings, or type instead.'
        : e.error === 'no-speech' ? "I didn't hear anything. Tap the mic and try again." : "The microphone didn't work. You can type instead." })
    }
    r.onend = () => { if (final) void send(final); else setPhase((p) => (p === 'listening' ? 'idle' : p)) }
    setHeard(''); setAnswer(null); setPhase('listening')
    try { window.speechSynthesis?.cancel() } catch { /* ignore */ }
    try { r.start() } catch { setPhase('typing') }
  }

  function start() { setOpen(true); if (supported) listen(); else setPhase('typing') }
  function close() { rec.current?.abort(); try { window.speechSynthesis?.cancel() } catch { /* ignore */ } setOpen(false); setPhase('idle'); setHeard(''); setAnswer(null) }

  useEffect(() => () => rec.current?.abort(), [])

  function submitTyped(e: FormEvent) { e.preventDefault(); const t = typed; setTyped(''); void send(t) }

  return (
    <>
      <button type="button" onClick={start} aria-label="Talk to the calendar"
        className="fixed bottom-24 right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-ink text-cream shadow-xl active:scale-95 lg:bottom-36 lg:right-10 lg:h-20 lg:w-20">
        <Mic className="h-7 w-7 lg:h-9 lg:w-9" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-6" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label="Talk to the calendar" onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-xl flex-col gap-4 rounded-t-[32px] bg-cream p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-[32px] lg:p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">{phase === 'listening' ? 'Listening…' : phase === 'thinking' ? 'One moment…' : phase === 'typing' ? 'Type a command' : 'Talk to the calendar'}</h2>
              <button type="button" onClick={close} aria-label="Close" className="rounded-full p-2 text-ink-2"><X /></button>
            </div>

            {heard && <p className="text-xl font-bold text-ink-2">"{heard}"</p>}
            {answer && <p className={`rounded-2xl px-4 py-3 text-xl font-extrabold ${answer.ok ? 'bg-white' : 'bg-red-50 text-red-800'}`}>{answer.text}</p>}

            {phase === 'typing' ? (
              <form onSubmit={submitTyped} className="flex gap-2">
                <input id="voice-typed" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="e.g. add milk to the shopping list"
                  className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold" />
                <button type="submit" disabled={!typed.trim()} aria-label="Send" className="rounded-2xl bg-amber px-4 disabled:opacity-40"><Send /></button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-4 py-2">
                <button type="button" onClick={listen} disabled={phase === 'listening' || phase === 'thinking'} aria-label="Speak"
                  className={`flex h-24 w-24 items-center justify-center rounded-full text-ink ${phase === 'listening' ? 'animate-pulse bg-amber' : 'bg-amber/80'} disabled:opacity-70`}>
                  <Mic className="h-11 w-11" aria-hidden="true" />
                </button>
              </div>
            )}

            {(phase === 'idle' || phase === 'listening' || phase === 'typing') && !answer && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-faint">Try saying</span>
                <div className="flex flex-wrap gap-2">
                  {examples.map((x) => (
                    <button key={x} type="button" onClick={() => void send(x)} className="rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm font-bold text-ink-2">{x}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              {phase !== 'typing'
                ? <button type="button" onClick={() => { rec.current?.abort(); setPhase('typing') }} className="flex items-center gap-2 font-extrabold text-muted"><Keyboard size={18} aria-hidden="true" />Type instead</button>
                : supported ? <button type="button" onClick={listen} className="flex items-center gap-2 font-extrabold text-muted"><Mic size={18} aria-hidden="true" />Speak instead</button> : <span />}
              {phase === 'answered' && <button type="button" onClick={supported ? listen : () => setPhase('typing')} className="rounded-full bg-ink px-5 py-2.5 font-extrabold text-white">Say another</button>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
