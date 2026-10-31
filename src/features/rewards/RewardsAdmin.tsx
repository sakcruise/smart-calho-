import { useState, type FormEvent } from 'react'
import { Gift, ImagePlus, Trash2 } from 'lucide-react'
import type { FamilyMember, Reward } from '../../lib/types'
import { Avatar } from '../../components/Avatar'
import { REWARD_ICONS, RewardArt } from './RewardArt'
import { uploadRewardPhoto, useRewards, type MemberStars } from './useRewards'

interface Draft {
  kind: 'goal' | 'surprise'
  memberId: string
  id?: string
  name: string
  icon: string
  image_path: string | null
  stars: number
}

/** Parent tools: goals, surprise gifts, star adjustments and history per child. */
export function RewardsAdmin({ members }: { members: FamilyMember[] }) {
  const kids = members.filter((m) => m.role === 'kid')
  const r = useRewards(members)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function onPhoto(file: File | undefined) {
    if (!file || !draft) return
    setUploading(true); setUploadError(null)
    const path = await uploadRewardPhoto(file)
    setUploading(false)
    if (path) setDraft({ ...draft, image_path: path })
    else setUploadError("That photo didn't upload. Try a smaller JPG or PNG.")
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft || !draft.name.trim() || draft.stars < 1) return
    if (draft.kind === 'goal') {
      await r.saveGoal(draft.memberId, { id: draft.id, name: draft.name.trim(), icon: draft.icon, image_path: draft.image_path, star_target: draft.stars })
    } else {
      await r.addSurprise(draft.memberId, { name: draft.name.trim(), icon: draft.icon, image_path: draft.image_path, afterStars: draft.stars })
    }
    setDraft(null)
  }

  if (kids.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-black lg:text-3xl">Stars & rewards</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {kids.map((kid) => {
          const info = r.byMember[kid.id]
          return info ? (
            <KidRewards key={kid.id} kid={kid} info={info}
              onEditGoal={(g) => setDraft(g
                ? { kind: 'goal', memberId: kid.id, id: g.id, name: g.name, icon: g.icon, image_path: g.image_path, stars: g.star_target }
                : { kind: 'goal', memberId: kid.id, name: '', icon: 'ticket', image_path: null, stars: 25 })}
              onAddSurprise={() => setDraft({ kind: 'surprise', memberId: kid.id, name: '', icon: 'gift', image_path: null, stars: 15 })}
              onClaim={(g) => void r.claimGoal(g)}
              onDelete={(x) => void r.deleteReward(x)}
              onAdjust={(d, reason) => void r.adjust(kid.id, d, reason)} />
          ) : null
        })}
      </div>

      {draft && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={() => setDraft(null)}>
          <form onSubmit={save} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-xl flex-col gap-5 overflow-auto rounded-t-[28px] bg-cream p-5 sm:rounded-[32px] lg:p-8">
            <h2 className="text-2xl font-black lg:text-3xl">
              {draft.kind === 'goal' ? (draft.id ? 'Edit goal' : 'New goal') : 'New surprise gift'} · {members.find((m) => m.id === draft.memberId)?.name}
            </h2>
            {draft.kind === 'surprise' && (
              <p className="font-bold text-muted">Kept secret. They'll see a wrapped present appear when they've earned enough stars, and open it on the screen.</p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-extrabold text-muted">{draft.kind === 'goal' ? 'Reward' : 'The surprise'}</span>
              <input id="reward-name" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={draft.kind === 'goal' ? 'e.g. Cinema trip' : 'e.g. New Lego set'} className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold" />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-extrabold text-muted">Picture</span>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
                {Object.entries(REWARD_ICONS).map(([key, { Icon, label }]) => (
                  <button key={key} type="button" aria-label={label} aria-pressed={draft.icon === key && !draft.image_path}
                    onClick={() => setDraft({ ...draft, icon: key, image_path: null })}
                    className={`flex aspect-square items-center justify-center rounded-2xl border-2 ${draft.icon === key && !draft.image_path ? 'border-ink bg-amber' : 'border-transparent bg-white'}`}>
                    <Icon aria-hidden="true" size={26} />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {draft.image_path && <RewardArt icon={draft.icon} imagePath={draft.image_path} size={56} />}
                <label className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-line bg-white px-4 py-2.5 font-extrabold text-ink-2">
                  <ImagePlus aria-hidden="true" size={20} />{uploading ? 'Uploading…' : draft.image_path ? 'Change photo' : 'Or use a photo'}
                  <input id="reward-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => void onPhoto(e.target.files?.[0])} />
                </label>
              </div>
              {uploadError && <p className="font-bold text-red-700">{uploadError}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-extrabold text-muted">{draft.kind === 'goal' ? 'Stars needed' : 'Unlocks after this many more stars'}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Fewer" onClick={() => setDraft({ ...draft, stars: Math.max(1, draft.stars - 5) })} className="h-11 w-11 rounded-full border-2 border-line bg-white text-lg font-black">−5</button>
                <input id="reward-stars" type="number" min={1} max={500} value={draft.stars} onChange={(e) => setDraft({ ...draft, stars: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-20 rounded-xl border-2 border-line bg-white px-2 py-2 text-center text-xl font-black tabular-nums" />
                <button type="button" aria-label="More" onClick={() => setDraft({ ...draft, stars: Math.min(500, draft.stars + 5) })} className="h-11 w-11 rounded-full border-2 border-line bg-white text-lg font-black">+5</button>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t-2 border-sand pt-4">
              <button type="button" onClick={() => setDraft(null)} className="rounded-full border-2 border-line bg-white px-5 py-3 font-extrabold text-ink-2">Cancel</button>
              <button type="submit" disabled={!draft.name.trim() || uploading} className="rounded-full bg-ink px-6 py-3 font-extrabold text-white disabled:opacity-40">Save</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function KidRewards({ kid, info, onEditGoal, onAddSurprise, onClaim, onDelete, onAdjust }: {
  kid: FamilyMember; info: MemberStars
  onEditGoal: (g: Reward | null) => void; onAddSurprise: () => void; onClaim: (g: Reward) => void
  onDelete: (r: Reward) => void; onAdjust: (delta: number, reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const goal = info.goal
  const surprises = [...info.unopened, ...info.opened.slice(-3)]
  const lockedCount = info.nextSurpriseAt !== null

  return (
    <div className="flex flex-col gap-4 rounded-[28px] bg-white p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Avatar name={kid.name} colour={kid.colour} size={48} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xl font-extrabold">{kid.name}</span>
          <span className="text-sm font-bold text-muted">★ {info.balance} to spend · {info.lifetime} earned · streak {info.streak}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-cream p-3">
        {goal ? (
          <>
            <RewardArt icon={goal.icon} imagePath={goal.image_path} size={52} colour={kid.colour} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-extrabold">{goal.name}</span>
              <span className="text-sm font-bold text-muted">{Math.min(info.balance, goal.star_target)} of {goal.star_target} stars</span>
            </div>
            {info.goalReady ? (
              <button type="button" onClick={() => onClaim(goal)} className="rounded-full bg-green-700 px-4 py-2.5 font-extrabold text-white">Mark as given</button>
            ) : (
              <button type="button" onClick={() => onEditGoal(goal)} className="rounded-full border-2 border-line bg-white px-4 py-2 font-extrabold text-ink-2">Edit</button>
            )}
          </>
        ) : (
          <>
            <span className="flex-1 font-bold text-muted">No goal yet</span>
            <button type="button" onClick={() => onEditGoal(null)} className="rounded-full bg-amber px-4 py-2.5 font-extrabold">Set a goal</button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-extrabold">Surprise gifts</span>
          <button type="button" onClick={onAddSurprise} className="flex items-center gap-1.5 rounded-full border-2 border-line px-3 py-1.5 text-sm font-extrabold text-ink-2"><Gift aria-hidden="true" size={16} />Add</button>
        </div>
        {lockedCount && <p className="text-sm font-bold text-muted">Next one unlocks in {(info.nextSurpriseAt ?? 0) - info.lifetime} stars.</p>}
        {surprises.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <RewardArt icon={s.icon} imagePath={s.image_path} size={36} colour={kid.colour} />
            <span className="min-w-0 flex-1 truncate font-bold">{s.name}</span>
            <span className="shrink-0 text-sm font-extrabold text-muted">{s.claimed_at ? 'Opened' : 'Waiting to be opened'}</span>
            {!s.claimed_at && <button type="button" aria-label={`Delete ${s.name}`} onClick={() => onDelete(s)} className="p-1 text-faint"><Trash2 size={18} /></button>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-extrabold">Give or take stars</span>
        <div className="flex flex-wrap gap-2">
          <input id={`adj-reason-${kid.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (they'll see this)"
            className="min-w-0 flex-1 basis-40 rounded-full border-2 border-line bg-cream px-4 py-2 font-bold" />
          {[1, 5].map((n) => (
            <button key={n} type="button" onClick={() => { onAdjust(n, reason); setReason('') }} className="rounded-full bg-amber px-4 py-2 font-extrabold">+{n}</button>
          ))}
          <button type="button" onClick={() => { onAdjust(-1, reason); setReason('') }} disabled={info.balance === 0} className="rounded-full border-2 border-line bg-white px-4 py-2 font-extrabold text-ink-2 disabled:opacity-40">−1</button>
        </div>
      </div>

      <button type="button" onClick={() => setShowHistory(!showHistory)} className="self-start text-sm font-extrabold text-muted underline-offset-4 hover:underline">
        {showHistory ? 'Hide star history' : 'Show star history'}
      </button>
      {showHistory && (
        <div className="flex max-h-72 flex-col gap-1 overflow-auto">
          {info.history.length === 0 && <p className="text-sm font-bold text-faint">No stars yet.</p>}
          {info.history.slice(0, 60).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream px-3 py-2 text-sm">
              <span className="w-24 shrink-0 font-bold text-muted">{new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="min-w-0 flex-1 truncate font-bold">{e.reason ?? e.source}</span>
              <span className={`shrink-0 font-black ${e.delta < 0 ? 'text-red-700' : ''}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
