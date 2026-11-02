import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Clock3, Flame, Gift, Star, Users, Volume2, VolumeX } from 'lucide-react'
import { isMuted, setMuted } from '../../lib/sound'
import { useRewards } from '../rewards/useRewards'
import { RewardArt } from '../rewards/RewardArt'
import { KidStars } from '../rewards/KidStars'
import { SurpriseReveal } from '../rewards/SurpriseReveal'
import type { FamilyMember, Task, TaskCompletion } from '../../lib/types'
import { Avatar } from '../../components/Avatar'
import { TaskIcon } from './icons'
import { Celebration, cheer, type CelebrationInfo } from './Celebration'
import { ROUTINES, assigneesOf, currentRoutine, isScheduled, useTasks, type Routine } from './useTasks'

type Picker =
  | { kind: 'who'; task: Task; choices: FamilyMember[] }
  | { kind: 'undo'; task: Task; completion: TaskCompletion; by: FamilyMember | undefined }

const TINTS: Record<string, string> = {}
function tint(hex: string) {
  if (TINTS[hex]) return TINTS[hex]
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.85)
  TINTS[hex] = `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
  return TINTS[hex]
}

export function TaskBoard({ members, onGoToParents }: { members: FamilyMember[]; onGoToParents: () => void }) {
  const board = useTasks()
  const [routine, setRoutine] = useState<Routine>(currentRoutine)
  const [picker, setPicker] = useState<Picker | null>(null)
  const [celebration, setCelebration] = useState<CelebrationInfo | null>(null)
  const clearCelebration = useCallback(() => setCelebration(null), [])
  const rewards = useRewards(members)
  const [starsFor, setStarsFor] = useState<FamilyMember | null>(null)
  const [opening, setOpening] = useState<{ member: FamilyMember; rewardId: string } | null>(null)
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => {
    const on = () => setMutedState(isMuted())
    window.addEventListener('fsc-mute', on)
    return () => window.removeEventListener('fsc-mute', on)
  }, [])

  const kids = members.filter((m) => m.role === 'kid')
  const parents = members.filter((m) => m.role === 'parent')
  const scheduled = board.tasks.filter((t) => isScheduled(t, routine))
  const shared = scheduled.filter((t) => t.all_members)
  const parentTasks = scheduled.filter((t) => !t.all_members && t.assignee_ids.some((id) => parents.some((p) => p.id === id)))
  const tasksFor = (m: FamilyMember) => scheduled.filter((t) => !t.all_members && t.assignee_ids.includes(m.id))

  const counts = useMemo(() => Object.fromEntries(ROUTINES.map((r) => [r.id, board.tasks.filter((t) => isScheduled(t, r.id)).length])), [board.tasks])

  async function doComplete(task: Task, member: FamilyMember, from?: DOMRect) {
    setPicker(null)
    const status = await board.complete(task, member)
    if (!status) return
    cheer()
    if (status === 'done' && task.stars > 0 && from) flyStar(from, member.id, member.colour)
    setCelebration({
      key: Date.now(),
      colour: member.colour,
      title: status === 'done' ? (task.stars > 0 ? `+${task.stars} ★` : 'Done!') : 'Well done!',
      subtitle: status === 'done' ? `${member.name} · ${task.title}` : `${member.name} · a grown-up will check it`,
    })
  }

  function tapPersonal(task: Task, member: FamilyMember, e?: MouseEvent) {
    const c = board.completionFor(task.id, member.id)
    if (c) setPicker({ kind: 'undo', task, completion: c, by: member })
    else void doComplete(task, member, (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect())
  }

  function tapShared(task: Task, choices: FamilyMember[], e?: MouseEvent) {
    const c = board.sharedCompletion(task.id)
    if (c) setPicker({ kind: 'undo', task, completion: c, by: members.find((m) => m.id === c.member_id) })
    else if (choices.length === 1) void doComplete(task, choices[0], (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect())
    else setPicker({ kind: 'who', task, choices })
  }

  const columnCount = kids.length + (parentTasks.length || parents.length ? 1 : 0) + (shared.length ? 1 : 0)
  const empty = board.tasks.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-4 lg:gap-4 lg:px-14 lg:py-6">
        <h1 className="text-3xl font-black lg:text-5xl">{ROUTINES.find((r) => r.id === routine)?.label}</h1>
        <div className="flex w-full items-center gap-2 lg:w-auto lg:gap-3">
        <div className="flex flex-1 gap-2 lg:gap-3" role="tablist" aria-label="Routine">
          {ROUTINES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={routine === r.id} onClick={() => setRoutine(r.id)}
              className={`flex-1 whitespace-nowrap rounded-full px-2 py-2.5 text-[15px] font-extrabold lg:flex-none lg:px-7 lg:py-3.5 lg:text-2xl ${routine === r.id ? 'bg-ink text-white' : 'border-2 border-line bg-white text-ink-2'}`}>
              {r.label}{counts[r.id] ? <span className="ml-2 opacity-60">{counts[r.id]}</span> : null}
            </button>
          ))}
        </div>
          <button type="button" onClick={() => setMuted(!muted)} aria-label={muted ? 'Turn sounds on' : 'Turn sounds off'} aria-pressed={muted}
            className="shrink-0 rounded-full border-2 border-line bg-white p-2.5 text-ink-2 lg:p-3.5">
            {muted ? <VolumeX aria-hidden="true" className="h-5 w-5 lg:h-7 lg:w-7" /> : <Volume2 aria-hidden="true" className="h-5 w-5 lg:h-7 lg:w-7" />}
          </button>
        </div>
      </div>

      {empty ? (
        <div className="mx-4 mb-6 flex flex-1 p-6 lg:mx-14 lg:mb-8 flex-col items-center justify-center gap-4 rounded-[32px] border-2 border-dashed border-line text-center">
          <p className="text-2xl font-black lg:text-3xl">No tasks yet</p>
          <p className="max-w-xl text-lg lg:text-xl font-bold text-muted">Parents can add routines for each child, or add a starter set in one tap.</p>
          <button type="button" onClick={onGoToParents} className="mt-2 rounded-full bg-amber px-8 py-4 text-2xl font-extrabold">Set up tasks</button>
        </div>
      ) : (
        <div className="fsc-board grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-6 lg:gap-5 lg:px-14" style={{ ['--cols' as string]: Math.max(columnCount, 1) }}>
          <style>{`@media (min-width: 1024px) { .fsc-board { grid-template-columns: repeat(var(--cols), minmax(0, 1fr)) } }`}</style>
          {kids.map((kid) => {
            const list = tasksFor(kid)
            const done = list.filter((t) => board.completionFor(t.id, kid.id)).length
            const icons = kid.reading_level === 'icons'
            const info = rewards.byMember[kid.id]
            return (
              <Column key={kid.id} colour={kid.colour} head={<Avatar name={kid.name} colour={kid.colour} size={64} />}
                name={kid.name} sub={`${done} of ${list.length} done`} stars={info?.balance ?? 0} starTarget={kid.id}
                streak={info?.streak ?? 0} onStars={() => setStarsFor(kid)}
                footer={info && <KidFooter info={info} colour={kid.colour} onOpen={(rewardId) => setOpening({ member: kid, rewardId })} onStars={() => setStarsFor(kid)} />}>
                <div className={`grid gap-3 ${list.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {list.map((t) => {
                    const c = board.completionFor(t.id, kid.id)
                    return (
                      <Tile key={t.id} task={t} colour={kid.colour} state={c ? c.status : 'todo'} big={icons}
                        onTap={(e) => tapPersonal(t, kid, e)} />
                    )
                  })}
                  {list.length === 0 && <Nothing />}
                </div>
              </Column>
            )
          })}

          {(parentTasks.length > 0 || parents.length > 0) && (
            <Column colour={parents[0]?.colour ?? '#F26B5B'} name={parents.map((p) => p.name).join(' & ') || 'Parents'}
              head={<div className="flex">{parents.map((p, i) => (
                <span key={p.id} style={{ marginLeft: i ? -14 : 0 }} className="rounded-full ring-4 ring-white"><Avatar name={p.name} colour={p.colour} size={60} /></span>
              ))}</div>}
              sub={`${parentTasks.filter((t) => assigneesOf(t, parents).every((p) => board.completionFor(t.id, p.id)) || board.sharedCompletion(t.id)).length} of ${parentTasks.length} done`}>
              <div className="flex flex-col gap-3">
                {parentTasks.map((t) => {
                  const who = parents.filter((p) => t.assignee_ids.includes(p.id))
                  const c = board.sharedCompletion(t.id)
                  return (
                    <Row key={t.id} task={t} colour={who.length === 1 ? who[0].colour : '#7F838C'} done={!!c}
                      tag={c ? `Done · ${members.find((m) => m.id === c.member_id)?.name ?? ''}` : who.length === 1 ? who[0].name : 'Either'}
                      onTap={(e) => tapShared(t, who, e)} />
                  )
                })}
                {parentTasks.length === 0 && <Nothing />}
              </div>
            </Column>
          )}

          {shared.length > 0 && (
            <Column colour="#2E9E63" name="Everyone" sub="Anyone can tick these"
              head={<span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2E9E63] text-white"><Users size={32} aria-hidden="true" /></span>}>
              <div className="flex flex-col gap-3">
                {shared.map((t) => {
                  const c = board.sharedCompletion(t.id)
                  return (
                    <Row key={t.id} task={t} colour="#2E9E63" done={!!c}
                      tag={c ? `Done · ${members.find((m) => m.id === c.member_id)?.name ?? ''}` : t.stars ? `★ ${t.stars}` : ''}
                      onTap={(e) => tapShared(t, members.filter((m) => m.role !== 'guest'), e)} />
                  )
                })}
              </div>
            </Column>
          )}
        </div>
      )}

      {picker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/50 p-6" onClick={() => setPicker(null)}>
          <div role="dialog" aria-modal="true" className="flex max-h-full max-w-3xl flex-col gap-5 overflow-auto rounded-[28px] bg-cream p-6 lg:gap-6 lg:rounded-[36px] lg:p-10" onClick={(e) => e.stopPropagation()}>
            {picker.kind === 'who' ? (
              <>
                <h2 className="text-2xl font-black lg:text-4xl">Who did “{picker.task.title}”?</h2>
                <div className="flex flex-wrap gap-3 lg:gap-4">
                  {picker.choices.map((m) => (
                    <button key={m.id} type="button" onClick={() => void doComplete(picker.task, m)}
                      className="flex min-w-28 flex-col items-center gap-2 rounded-[24px] bg-white px-4 py-4 lg:min-w-40 lg:gap-3 lg:px-6 lg:py-6">
                      <Avatar name={m.name} colour={m.colour} size={88} />
                      <span className="text-lg font-extrabold lg:text-2xl">{m.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black lg:text-4xl">Untick “{picker.task.title}”?</h2>
                <p className="text-lg font-bold text-muted lg:text-xl">
                  {picker.by ? `${picker.by.name} ticked this.` : 'This was ticked.'}{' '}
                  {picker.completion.status === 'done' && picker.task.stars ? `The ${picker.task.stars} ★ will be taken back.` : ''}
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => { void board.undo(picker.completion); setPicker(null) }}
                    className="rounded-full bg-ink px-6 py-3 text-lg font-extrabold text-white lg:px-8 lg:py-4 lg:text-2xl">Untick</button>
                  <button type="button" onClick={() => setPicker(null)}
                    className="rounded-full border-2 border-line bg-white px-6 py-3 text-lg font-extrabold text-ink-2 lg:px-8 lg:py-4 lg:text-2xl">Keep it</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {celebration && <Celebration info={celebration} onDone={clearCelebration} />}

      {starsFor && rewards.byMember[starsFor.id] && (
        <KidStars member={starsFor} info={rewards.byMember[starsFor.id]} onClose={() => setStarsFor(null)}
          onOpenSurprise={(rewardId) => { setOpening({ member: starsFor, rewardId }); setStarsFor(null) }} />
      )}
      {opening && (() => {
        const r = rewards.rewards.find((x) => x.id === opening.rewardId)
        return r ? (
          <SurpriseReveal reward={r} colour={opening.member.colour} name={opening.member.name}
            onOpened={() => void rewards.openSurprise(r)} onClose={() => setOpening(null)} />
        ) : null
      })()}
    </div>
  )
}

function Column({ colour, head, name, sub, stars, starTarget, streak, onStars, footer, children }: {
  colour: string; head: React.ReactNode; name: string; sub: string; stars?: number; starTarget?: string
  streak?: number; onStars?: () => void; footer?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section style={{ background: tint(colour) }} className="flex min-w-0 flex-col gap-3 rounded-[28px] p-4 lg:min-h-0 lg:gap-4 lg:rounded-[32px] lg:p-6">
      <div className="flex items-center gap-4">
        {head}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-2xl font-black lg:text-3xl">{name}</span>
          <span className="flex items-center gap-2 text-base font-bold text-muted lg:text-lg">
            {sub}
            {streak ? <span className="flex items-center gap-0.5 text-orange-600"><Flame aria-hidden="true" size={18} />{streak}</span> : null}
          </span>
        </div>
        {stars !== undefined && (
          <button type="button" onClick={onStars} data-star-target={starTarget} aria-label={`${name}: ${stars} stars. Open star jar`}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xl font-black lg:px-4 lg:py-2 lg:text-2xl">
            <Star aria-hidden="true" size={26} fill="#F2A51A" stroke="#F2A51A" />{stars}
          </button>
        )}
      </div>
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-auto">{children}</div>
      {footer}
    </section>
  )
}

function Tile({ task, colour, state, big, onTap }: { task: Task; colour: string; state: 'todo' | 'done' | 'awaiting_approval'; big: boolean; onTap: (e: MouseEvent) => void }) {
  const done = state === 'done'
  const waiting = state === 'awaiting_approval'
  const label = big ? task.title.split(' ').slice(0, 2).join(' ') : task.title
  return (
    <button type="button" onClick={onTap} aria-pressed={done || waiting}
      aria-label={`${task.title}${done ? ', done' : waiting ? ', waiting for a grown-up' : ''}`}
      style={done ? { background: colour, borderColor: colour } : waiting ? { borderColor: colour, borderStyle: 'dashed' } : { borderColor: colour }}
      className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded-[22px] border-[3px] bg-white px-3 py-3 lg:min-h-40 lg:gap-2.5 lg:rounded-[26px] lg:py-4 text-center transition active:scale-95 ${done ? 'text-white' : 'text-ink'}`}>
      {done ? (
        <svg aria-hidden="true" width={big ? 84 : 60} height={big ? 84 : 60} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
      ) : waiting ? (
        <Clock3 aria-hidden="true" size={big ? 72 : 52} style={{ color: colour }} strokeWidth={2.2} />
      ) : (
        <span style={{ color: colour }}><TaskIcon name={task.icon} size={big ? 72 : 52} /></span>
      )}
      <span className={`font-extrabold leading-tight ${big ? 'text-xl lg:text-2xl' : 'text-lg lg:text-[22px]'} ${done ? 'line-through decoration-2' : ''}`}>{label}</span>
      {waiting ? (
        <span className="text-base font-extrabold" style={{ color: colour }}>Waiting for a grown-up</span>
      ) : !done && !big && task.stars > 0 ? (
        <span className="text-base font-extrabold" style={{ color: colour }}>★ {task.stars}</span>
      ) : null}
    </button>
  )
}

function Row({ task, colour, done, tag, onTap }: { task: Task; colour: string; done: boolean; tag: string; onTap: (e: MouseEvent) => void }) {
  return (
    <button type="button" onClick={onTap} aria-pressed={done}
      style={{ borderColor: colour, background: done ? colour : '#FFFFFF' }}
      className={`flex min-h-20 items-center gap-3 rounded-[22px] border-[3px] px-4 text-left lg:min-h-24 lg:gap-4 lg:rounded-[24px] lg:px-5 transition active:scale-[0.98] ${done ? 'text-white' : 'text-ink'}`}>
      <span style={{ color: done ? '#FFFFFF' : colour }}><TaskIcon name={task.icon} size={44} /></span>
      <span className={`min-w-0 flex-1 text-lg font-extrabold lg:text-[22px] ${done ? 'line-through decoration-2' : ''}`}>{task.title}</span>
      <span className={`shrink-0 text-base font-extrabold ${done ? 'text-white' : ''}`} style={done ? undefined : { color: colour }}>{tag}</span>
    </button>
  )
}

function Nothing() {
  return <p className="col-span-2 py-2 text-lg font-bold text-faint lg:py-4 lg:text-xl">Nothing for this routine.</p>
}

/** Goal progress and any present waiting, at the foot of a child's column. */
function KidFooter({ info, colour, onOpen, onStars }: {
  info: import('../rewards/useRewards').MemberStars; colour: string; onOpen: (rewardId: string) => void; onStars: () => void
}) {
  const goal = info.goal
  return (
    <div className="flex flex-col gap-2">
      {info.unopened[0] && (
        <button type="button" onClick={() => onOpen(info.unopened[0].id)} style={{ background: colour }}
          className="fsc-wiggle flex items-center justify-center gap-3 rounded-[20px] px-4 py-3 text-lg font-black text-white lg:text-xl">
          <style>{`@keyframes fsc-wig { 0%,90%,100% { transform: rotate(0) } 93% { transform: rotate(-3deg) } 97% { transform: rotate(3deg) } } .fsc-wiggle { animation: fsc-wig 2.4s ease-in-out infinite } @media (prefers-reduced-motion: reduce) { .fsc-wiggle { animation: none } }`}</style>
          <Gift aria-hidden="true" size={30} />A present for you! Tap to open
        </button>
      )}
      {goal ? (
        <button type="button" onClick={onStars} className="flex items-center gap-3 rounded-[20px] bg-white p-3 text-left">
          <RewardArt icon={goal.icon} imagePath={goal.image_path} size={44} colour={colour} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-base font-extrabold lg:text-lg">
              {info.goalReady ? `${goal.name} — you did it!` : `${goal.name} · ${Math.min(info.balance, goal.star_target)} of ${goal.star_target}`}
            </span>
            <div className="h-3 rounded-full bg-sand">
              <div className="h-full rounded-full bg-amber transition-all" style={{ width: `${Math.min(100, (info.balance / goal.star_target) * 100)}%` }} />
            </div>
          </div>
        </button>
      ) : info.nextSurpriseAt !== null ? (
        <div className="flex items-center gap-3 rounded-[20px] bg-white p-3 text-base font-extrabold text-muted">
          <Gift aria-hidden="true" size={28} style={{ color: colour }} />A surprise in {info.nextSurpriseAt - info.lifetime} stars
        </div>
      ) : null}
    </div>
  )
}

/** A star that flies from the ticked tile into the child's star counter. */
function flyStar(from: DOMRect, memberId: string, colour: string) {
  const target = document.querySelector(`[data-star-target="${memberId}"]`)
  if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const to = target.getBoundingClientRect()
  const el = document.createElement('div')
  el.innerHTML = `<svg width="56" height="56" viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="#F2A51A" stroke="${colour}" stroke-width="1.2"/></svg>`
  Object.assign(el.style, { position: 'fixed', left: '0', top: '0', zIndex: '70', pointerEvents: 'none' })
  document.body.appendChild(el)
  const sx = from.left + from.width / 2 - 28, sy = from.top + from.height / 2 - 28
  const ex = to.left + to.width / 2 - 28, ey = to.top + to.height / 2 - 28
  const anim = el.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(.6)`, opacity: 0 },
    { transform: `translate(${sx}px, ${sy - 60}px) scale(1.3)`, opacity: 1, offset: 0.25 },
    { transform: `translate(${ex}px, ${ey}px) scale(.5)`, opacity: 1 },
  ], { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' })
  anim.onfinish = () => {
    el.remove()
    target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 })
  }
}
