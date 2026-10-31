import { useCallback, useMemo, useState } from 'react'
import { Clock3, Star, Users } from 'lucide-react'
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

  const kids = members.filter((m) => m.role === 'kid')
  const parents = members.filter((m) => m.role === 'parent')
  const scheduled = board.tasks.filter((t) => isScheduled(t, routine))
  const shared = scheduled.filter((t) => t.all_members)
  const parentTasks = scheduled.filter((t) => !t.all_members && t.assignee_ids.some((id) => parents.some((p) => p.id === id)))
  const tasksFor = (m: FamilyMember) => scheduled.filter((t) => !t.all_members && t.assignee_ids.includes(m.id))

  const counts = useMemo(() => Object.fromEntries(ROUTINES.map((r) => [r.id, board.tasks.filter((t) => isScheduled(t, r.id)).length])), [board.tasks])

  async function doComplete(task: Task, member: FamilyMember) {
    setPicker(null)
    const status = await board.complete(task, member)
    if (!status) return
    cheer()
    setCelebration({
      key: Date.now(),
      colour: member.colour,
      title: status === 'done' ? (task.stars > 0 ? `+${task.stars} ★` : 'Done!') : 'Well done!',
      subtitle: status === 'done' ? `${member.name} · ${task.title}` : `${member.name} · a grown-up will check it`,
    })
  }

  function tapPersonal(task: Task, member: FamilyMember) {
    const c = board.completionFor(task.id, member.id)
    if (c) setPicker({ kind: 'undo', task, completion: c, by: member })
    else void doComplete(task, member)
  }

  function tapShared(task: Task, choices: FamilyMember[]) {
    const c = board.sharedCompletion(task.id)
    if (c) setPicker({ kind: 'undo', task, completion: c, by: members.find((m) => m.id === c.member_id) })
    else if (choices.length === 1) void doComplete(task, choices[0])
    else setPicker({ kind: 'who', task, choices })
  }

  const columnCount = kids.length + (parentTasks.length || parents.length ? 1 : 0) + (shared.length ? 1 : 0)
  const empty = board.tasks.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-4 lg:gap-4 lg:px-14 lg:py-6">
        <h1 className="text-3xl font-black lg:text-5xl">{ROUTINES.find((r) => r.id === routine)?.label}</h1>
        <div className="flex w-full gap-2 lg:w-auto lg:gap-3" role="tablist" aria-label="Routine">
          {ROUTINES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={routine === r.id} onClick={() => setRoutine(r.id)}
              className={`flex-1 whitespace-nowrap rounded-full px-2 py-2.5 text-[15px] font-extrabold lg:flex-none lg:px-7 lg:py-3.5 lg:text-2xl ${routine === r.id ? 'bg-ink text-white' : 'border-2 border-line bg-white text-ink-2'}`}>
              {r.label}{counts[r.id] ? <span className="ml-2 opacity-60">{counts[r.id]}</span> : null}
            </button>
          ))}
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
            return (
              <Column key={kid.id} colour={kid.colour} head={<Avatar name={kid.name} colour={kid.colour} size={64} />}
                name={kid.name} sub={`${done} of ${list.length} done`} stars={board.stars[kid.id] ?? 0}>
                <div className={`grid gap-3 ${list.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {list.map((t) => {
                    const c = board.completionFor(t.id, kid.id)
                    return (
                      <Tile key={t.id} task={t} colour={kid.colour} state={c ? c.status : 'todo'} big={icons}
                        onTap={() => tapPersonal(t, kid)} />
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
                    <Row key={t.id} task={t} colour={who.length === 1 ? who[0].colour : '#8A7F6C'} done={!!c}
                      tag={c ? `Done · ${members.find((m) => m.id === c.member_id)?.name ?? ''}` : who.length === 1 ? who[0].name : 'Either'}
                      onTap={() => tapShared(t, who)} />
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
                      onTap={() => tapShared(t, members.filter((m) => m.role !== 'guest'))} />
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
    </div>
  )
}

function Column({ colour, head, name, sub, stars, children }: {
  colour: string; head: React.ReactNode; name: string; sub: string; stars?: number; children: React.ReactNode
}) {
  return (
    <section style={{ background: tint(colour) }} className="flex min-w-0 flex-col gap-3 rounded-[28px] p-4 lg:min-h-0 lg:gap-4 lg:rounded-[32px] lg:p-6">
      <div className="flex items-center gap-4">
        {head}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-2xl font-black lg:text-3xl">{name}</span>
          <span className="text-base font-bold text-muted lg:text-lg">{sub}</span>
        </div>
        {stars !== undefined && (
          <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xl font-black lg:px-4 lg:py-2 lg:text-2xl">
            <Star aria-hidden="true" size={26} fill="#F2A51A" stroke="#F2A51A" />{stars}
          </span>
        )}
      </div>
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-auto">{children}</div>
    </section>
  )
}

function Tile({ task, colour, state, big, onTap }: { task: Task; colour: string; state: 'todo' | 'done' | 'awaiting_approval'; big: boolean; onTap: () => void }) {
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

function Row({ task, colour, done, tag, onTap }: { task: Task; colour: string; done: boolean; tag: string; onTap: () => void }) {
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
