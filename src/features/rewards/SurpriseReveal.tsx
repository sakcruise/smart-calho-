import { useEffect, useState } from 'react'
import type { Reward } from '../../lib/types'
import { RewardArt } from './RewardArt'
import { Celebration, cheer } from '../tasks/Celebration'

/** Wrapped box: wobbles, then the lid flies off and the surprise is revealed. Opening marks it claimed. */
export function SurpriseReveal({ reward, colour, name, onOpened, onClose }: {
  reward: Reward; colour: string; name: string; onOpened: () => void; onClose: () => void
}) {
  const [stage, setStage] = useState<'closed' | 'opening' | 'open'>('closed')

  useEffect(() => {
    if (stage !== 'opening') return
    const id = setTimeout(() => { setStage('open'); cheer(); onOpened() }, 900)
    return () => clearTimeout(id)
  }, [stage, onOpened])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4" onClick={stage === 'open' ? onClose : undefined}>
      <style>{`
        @keyframes fsc-wobble { 0%,100% { transform: rotate(0) } 20% { transform: rotate(-8deg) } 40% { transform: rotate(7deg) } 60% { transform: rotate(-5deg) } 80% { transform: rotate(3deg) } }
        @keyframes fsc-lid { 0% { transform: translateY(0) rotate(0) } 100% { transform: translateY(-240px) rotate(-35deg); opacity: 0 } }
        @keyframes fsc-rise { 0% { transform: scale(.4) translateY(40px); opacity: 0 } 100% { transform: scale(1) translateY(0); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .fsc-anim { animation: none !important } }
      `}</style>
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-[36px] bg-cream p-8 text-center" onClick={(e) => e.stopPropagation()}>
        {stage !== 'open' ? (
          <>
            <p className="text-2xl font-black lg:text-3xl">A surprise for {name}!</p>
            <button type="button" aria-label="Open the present" onClick={() => setStage('opening')} className="relative h-56 w-56">
              <svg viewBox="0 0 200 200" className="fsc-anim h-full w-full" style={{ animation: stage === 'closed' ? 'fsc-wobble 1.4s ease-in-out infinite' : 'none' }}>
                <rect x="30" y="80" width="140" height="110" rx="10" fill={colour} />
                <rect x="90" y="80" width="20" height="110" fill="#F2A51A" />
                <g className="fsc-anim" style={{ transformOrigin: '100px 70px', animation: stage === 'opening' ? 'fsc-lid .9s ease-in forwards' : 'none' }}>
                  <rect x="20" y="56" width="160" height="32" rx="8" fill={colour} stroke="#1D1F24" strokeOpacity="0.15" strokeWidth="2" />
                  <rect x="90" y="56" width="20" height="32" fill="#F2A51A" />
                  <path d="M100 56 C 70 20, 50 40, 70 54 Z M100 56 C 130 20, 150 40, 130 54 Z" fill="#F2A51A" stroke="#B8780E" strokeWidth="3" />
                </g>
              </svg>
            </button>
            <p className="text-lg font-extrabold text-muted">Tap the present to open it</p>
          </>
        ) : (
          <>
            <div className="fsc-anim flex flex-col items-center gap-4" style={{ animation: 'fsc-rise .5s ease-out both' }}>
              <RewardArt icon={reward.icon} imagePath={reward.image_path} size={160} colour={colour} />
              <p className="text-lg font-extrabold uppercase tracking-[0.08em] text-muted">You got</p>
              <p className="text-4xl font-black lg:text-5xl">{reward.name}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-ink px-8 py-4 text-xl font-extrabold text-white">Yay!</button>
          </>
        )}
      </div>
      {stage === 'open' && <Celebration info={{ key: 1, colour, title: '', subtitle: '' }} onDone={() => undefined} confettiOnly />}
    </div>
  )
}
