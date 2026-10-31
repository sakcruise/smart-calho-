import { useState } from 'react'
import { verifyPin } from '../../lib/pin'
import type { FamilyMember } from '../../lib/types'

/** Parent PIN pad for the wall screen. Unlocks when the PIN matches any parent's hash. */
export function PinGate({ parents, onUnlock, onCancel }: { parents: FamilyMember[]; onUnlock: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)

  async function press(d: string) {
    if (wrong) setWrong(false)
    const next = pin + d
    setPin(next)
    if (next.length < 4) return
    for (const p of parents) {
      if (await verifyPin(next, p.pin_hash)) { onUnlock(); return }
    }
    if (next.length >= 6) { setWrong(true); setPin('') }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-ink p-6 text-cream">
      <h1 className="text-3xl font-black">Parents only</h1>
      <p className="font-bold text-line">Enter the parent PIN</p>
      <div className="flex gap-3" aria-live="polite">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-amber' : 'bg-white/20'}`} />
        ))}
      </div>
      {wrong && <p className="font-extrabold text-amber">That's not it. Try again.</p>}
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
          k === '' ? <span key={i} /> : (
            <button key={i} type="button" aria-label={k === '⌫' ? 'Delete' : k}
              onClick={() => k === '⌫' ? setPin(pin.slice(0, -1)) : void press(k)}
              className="h-20 w-20 rounded-full bg-white/10 text-3xl font-black text-cream active:bg-amber active:text-ink">
              {k}
            </button>
          )
        ))}
      </div>
      <button type="button" onClick={onCancel} className="mt-2 font-extrabold text-line underline-offset-4 hover:underline">Back</button>
    </div>
  )
}
