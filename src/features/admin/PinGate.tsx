import { useCallback, useEffect, useRef, useState } from 'react'
import { verifyPin } from '../../lib/pin'
import type { FamilyMember } from '../../lib/types'

/**
 * Parent PIN pad. Works by touch or keyboard (digits, Backspace, Enter, Esc).
 * Unlocks as soon as the digits match; Enter (or the tick) checks and says when it's wrong.
 */
export function PinGate({ parents, onUnlock, onCancel }: { parents: FamilyMember[]; onUnlock: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const [checking, setChecking] = useState(false)
  const pinRef = useRef('')
  const hashes = parents.map((p) => p.pin_hash).filter(Boolean) as string[]
  const ready = hashes.length > 0

  const matches = useCallback(async (value: string) => {
    for (const h of hashes) if (await verifyPin(value, h)) return true
    return false
  }, [hashes.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (v: string) => { pinRef.current = v; setPin(v) }

  const press = useCallback(async (d: string) => {
    setWrong(false)
    const next = (pinRef.current + d).slice(0, 6)
    set(next)
    if (next.length >= 4 && await matches(next)) { onUnlock(); return }
    if (next.length === 6) { setWrong(true); set('') }
  }, [matches, onUnlock])

  const back = useCallback(() => { setWrong(false); set(pinRef.current.slice(0, -1)) }, [])

  const confirm = useCallback(async () => {
    const v = pinRef.current
    if (!v) return
    setChecking(true)
    const ok = v.length >= 4 && await matches(v)
    setChecking(false)
    if (ok) onUnlock()
    else { setWrong(true); set('') }
  }, [matches, onUnlock])

  // Keyboard support for computers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); void press(e.key) }
      else if (e.key === 'Backspace') { e.preventDefault(); back() }
      else if (e.key === 'Enter') { e.preventDefault(); void confirm() }
      else if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, back, confirm, onCancel])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-ink p-6 text-cream">
      <h1 className="text-3xl font-black">Parents only</h1>
      <p className="font-bold text-line">{ready ? 'Enter the parent PIN (tap or type it)' : 'Loading the family…'}</p>
      <div className="flex gap-3" aria-live="polite" aria-label={`${pin.length} digits entered`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-amber' : 'bg-white/20'}`} />
        ))}
      </div>
      <p className={`h-6 font-extrabold text-amber ${wrong ? '' : 'invisible'}`}>That's not the PIN. Try again.</p>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'].map((k) => (
          <button key={k} type="button" disabled={!ready || checking}
            aria-label={k === 'back' ? 'Delete' : k === 'ok' ? 'Check PIN' : k}
            onClick={() => (k === 'back' ? back() : k === 'ok' ? void confirm() : void press(k))}
            className={`h-20 w-20 rounded-full text-3xl font-black disabled:opacity-40 ${k === 'ok' ? 'bg-amber text-ink' : 'bg-white/10 text-cream active:bg-amber active:text-ink'}`}>
            {k === 'back' ? '⌫' : k === 'ok' ? '✓' : k}
          </button>
        ))}
      </div>
      <button type="button" onClick={onCancel} className="mt-2 font-extrabold text-line underline-offset-4 hover:underline">Back</button>
    </div>
  )
}
