import { Award, Flame, Gift, Lock, Star, X } from 'lucide-react'
import type { FamilyMember } from '../../lib/types'
import { Avatar } from '../../components/Avatar'
import { RewardArt } from './RewardArt'
import { StarJar } from './StarJar'
import type { MemberStars } from './useRewards'

/** A child's star page: jar and goal, streak, surprises, badges and recent stars. */
export function KidStars({ member, info, onOpenSurprise, onClose }: {
  member: FamilyMember; info: MemberStars; onOpenSurprise: (rewardId: string) => void; onClose: () => void
}) {
  const goal = info.goal
  const toGo = goal ? Math.max(0, goal.star_target - info.balance) : 0
  const recent = info.history.slice(0, 8)

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${member.name}'s stars`} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-4xl flex-col gap-6 overflow-auto rounded-t-[28px] bg-cream p-5 sm:rounded-[36px] lg:p-10">
        <div className="flex items-center gap-4">
          <Avatar name={member.name} colour={member.colour} size={64} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate text-3xl font-black lg:text-4xl">{member.name}'s stars</h2>
            <span className="text-lg font-bold text-muted">{info.lifetime} earned in total</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full bg-white p-3"><X size={28} /></button>
        </div>

        <div className="grid gap-5 md:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center gap-2 rounded-[28px] bg-white p-5">
            <StarJar value={info.balance} target={goal?.star_target ?? Math.max(10, info.balance)} colour={member.colour} className="w-36 lg:w-44" />
            <span className="flex items-center gap-1.5 text-3xl font-black"><Star aria-hidden="true" size={28} fill="#F2A51A" stroke="#F2A51A" />{info.balance}</span>
            {goal && <span className="font-bold text-muted">of {goal.star_target}</span>}
          </div>

          <div className="flex flex-col gap-4">
            {goal ? (
              <div className="flex items-center gap-4 rounded-[28px] bg-white p-5">
                <RewardArt icon={goal.icon} imagePath={goal.image_path} size={88} colour={member.colour} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-faint">Saving up for</span>
                  <span className="text-2xl font-black lg:text-3xl">{goal.name}</span>
                  <span className="text-lg font-extrabold" style={{ color: member.colour }}>
                    {info.goalReady ? 'You did it! Ask a grown-up to hand it over.' : `${toGo} more ${toGo === 1 ? 'star' : 'stars'} to go`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-[28px] border-2 border-dashed border-line p-5 text-lg font-bold text-muted">No goal set yet. A grown-up can pick one in the Parents tab.</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-[24px] bg-white p-4">
                <Flame aria-hidden="true" size={40} className="shrink-0 text-orange-500" />
                <div className="flex flex-col">
                  <span className="text-2xl font-black">{info.streak} {info.streak === 1 ? 'day' : 'days'}</span>
                  <span className="text-sm font-bold text-muted">streak · best {info.bestStreak}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[24px] bg-white p-4">
                <Gift aria-hidden="true" size={40} className="shrink-0 text-pink-600" />
                <div className="flex flex-col">
                  <span className="text-lg font-black leading-tight">{info.nextSurpriseAt !== null ? 'A surprise is coming' : 'No surprise waiting'}</span>
                  {info.nextSurpriseAt !== null && <span className="text-sm font-bold text-muted">{info.nextSurpriseAt - info.lifetime} more stars</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {info.unopened.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-xl font-black">Presents to open</h3>
            <div className="flex flex-wrap gap-3">
              {info.unopened.map((r) => (
                <button key={r.id} type="button" onClick={() => onOpenSurprise(r.id)}
                  className="flex items-center gap-3 rounded-[24px] px-5 py-4 text-lg font-black text-white" style={{ background: member.colour }}>
                  <Gift aria-hidden="true" size={32} />Open me!
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-xl font-black">Badges</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {info.badges.map((b) => (
              <div key={b.id} className={`flex items-center gap-3 rounded-[20px] p-3 ${b.earned ? 'bg-white' : 'bg-white/50'}`}>
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${b.earned ? 'bg-amber text-ink' : 'bg-sand text-faint'}`}>
                  {b.earned ? <Award aria-hidden="true" size={26} /> : <Lock aria-hidden="true" size={20} />}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className={`truncate font-extrabold ${b.earned ? '' : 'text-faint'}`}>{b.label}</span>
                  <span className="line-clamp-2 text-xs font-bold leading-snug text-muted">{b.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-black">Recent stars</h3>
            {recent.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-[16px] bg-white px-4 py-3">
                <span className="min-w-0 truncate font-bold">{e.reason ?? 'Stars'}</span>
                <span className={`shrink-0 font-black ${e.delta < 0 ? 'text-red-700' : ''}`}>{e.delta > 0 ? `+${e.delta}` : e.delta} ★</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
