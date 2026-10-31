import { useEffect, useMemo } from 'react'

const COLOURS = ['#F2A51A', '#8B6CE6', '#3E8EE0', '#2BB3A0', '#F26B5B', '#2E9E63']

export interface CelebrationInfo {
  key: number
  colour: string
  title: string
  subtitle: string
}

/** Confetti burst plus a message, gone after ~1.6 s. Respects reduced motion. */
export function Celebration({ info, onDone }: { info: CelebrationInfo; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 1600)
    return () => clearTimeout(id)
  }, [info.key, onDone])

  const pieces = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2 + Math.random() * 0.3
    const dist = 260 + Math.random() * 280
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 120,
      rot: Math.random() * 720 - 360,
      colour: COLOURS[i % COLOURS.length],
      w: 10 + Math.random() * 10,
      h: 14 + Math.random() * 14,
      delay: Math.random() * 0.08,
    }
  }), [info.key])

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-live="polite">
      <style>{`
        @keyframes fsc-burst { 0% { transform: translate(0,0) rotate(0); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0 } }
        @keyframes fsc-pop { 0% { transform: scale(.6); opacity: 0 } 18% { transform: scale(1.08); opacity: 1 } 30% { transform: scale(1) } 85% { opacity: 1 } 100% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .fsc-piece { display: none } }
      `}</style>
      {pieces.map((p, i) => (
        <span key={i} className="fsc-piece absolute left-1/2 top-1/2 rounded-sm"
          style={{
            width: p.w, height: p.h, background: p.colour,
            ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--rot' as string]: `${p.rot}deg`,
            animation: `fsc-burst 1.2s cubic-bezier(.15,.7,.3,1) ${p.delay}s forwards`,
          }} />
      ))}
      <div className="flex flex-col items-center gap-2 rounded-[36px] bg-white px-14 py-10 shadow-2xl"
        style={{ animation: 'fsc-pop 1.6s ease-out forwards', borderTop: `12px solid ${info.colour}` }}>
        <span className="text-6xl font-black">{info.title}</span>
        <span className="text-2xl font-extrabold text-muted">{info.subtitle}</span>
      </div>
    </div>
  )
}

/** A rising three-note "ta-da"; silent until the screen has been touched once. */
export function cheer() {
  try {
    const ctx = new AudioContext()
    ;[523.25, 659.25, 783.99].forEach((f, i) => {
      const at = ctx.currentTime + i * 0.11
      const o = ctx.createOscillator(); const g = ctx.createGain()
      o.type = 'triangle'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.22, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.45)
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.5)
    })
  } catch { /* no audio available */ }
}
