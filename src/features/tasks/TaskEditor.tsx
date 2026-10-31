import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { FamilyMember, Task, TimeWindow } from '../../lib/types'
import { Avatar } from '../../components/Avatar'
import { TASK_ICONS, TaskIcon } from './icons'
import { starterRows } from './starter'
import { useTasks } from './useTasks'

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'After school' },
  { id: 'evening', label: 'Bedtime' },
  { id: 'anytime', label: 'Any time' },
]
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface Draft {
  id: string | null
  title: string
  icon: string
  assignee_ids: string[]
  all_members: boolean
  time_window: TimeWindow
  days_of_week: number[]
  stars: number
  needs_approval: boolean
}

const blank = (): Draft => ({
  id: null, title: '', icon: 'star', assignee_ids: [], all_members: false,
  time_window: 'morning', days_of_week: [0, 1, 2, 3, 4, 5, 6], stars: 1, needs_approval: false,
})

/** Parent tools for the task board: approval queue, task list and the add/edit form. */
export function TaskEditor({ members }: { members: FamilyMember[] }) {
  const board = useTasks()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '?'
  const taskTitle = (id: string) => board.tasks.find((t) => t.id === id)?.title ?? 'A task'

  function edit(t: Task) {
    setConfirmDelete(false)
    setDraft({
      id: t.id, title: t.title, icon: t.icon ?? 'star', assignee_ids: t.assignee_ids, all_members: t.all_members,
      time_window: t.time_window, days_of_week: t.days_of_week, stars: t.stars, needs_approval: t.needs_approval,
    })
  }

  function toggleAssignee(m: FamilyMember) {
    if (!draft) return
    const has = draft.assignee_ids.includes(m.id)
    const ids = has ? draft.assignee_ids.filter((x) => x !== m.id) : [...draft.assignee_ids, m.id]
    // Little ones need a grown-up to check by default
    const needs = !has && m.role === 'kid' && m.reading_level === 'icons' ? true : draft.needs_approval
    setDraft({ ...draft, assignee_ids: ids, all_members: false, needs_approval: needs })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !draft || !draft.title.trim()) return
    setBusy(true)
    const row = {
      title: draft.title.trim(), icon: draft.icon, assignee_ids: draft.all_members ? [] : draft.assignee_ids,
      all_members: draft.all_members, time_window: draft.time_window, days_of_week: [...draft.days_of_week].sort(),
      stars: draft.stars, needs_approval: draft.needs_approval, active: true,
    }
    if (draft.id) await supabase.from('tasks').update(row).eq('id', draft.id)
    else await supabase.from('tasks').insert({ ...row, sort_order: board.tasks.length })
    setBusy(false)
    setDraft(null)
  }

  async function remove() {
    if (!supabase || !draft?.id) return
    await supabase.from('tasks').delete().eq('id', draft.id)
    setDraft(null); setConfirmDelete(false)
  }

  async function addStarters() {
    if (!supabase) return
    setBusy(true)
    await supabase.from('tasks').insert(starterRows(members))
    setBusy(false)
  }

  const whoLabel = (t: Task) => t.all_members ? 'Everyone' : t.assignee_ids.map(memberName).join(', ') || 'Nobody'
  const daysLabel = (d: number[]) => d.length === 7 ? 'Every day' : d.join() === '1,2,3,4,5' ? 'Weekdays' : d.join() === '0,6' ? 'Weekends' : d.map((i) => DAYS[i]).join(' ')
  const valid = !!draft && draft.title.trim() !== '' && (draft.all_members || draft.assignee_ids.length > 0) && draft.days_of_week.length > 0

  return (
    <div className="flex flex-col gap-8">
      {board.pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-black lg:text-3xl">Waiting for you · {board.pending.length}</h2>
          {board.pending.map((c) => {
            const m = members.find((x) => x.id === c.member_id)
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-4 lg:gap-4 lg:p-5">
                {m && <Avatar name={m.name} colour={m.colour} size={48} />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lg font-extrabold lg:text-xl">{m?.name ?? 'Someone'} says: {taskTitle(c.task_id)}</span>
                  <span className="text-sm font-bold text-muted lg:text-base">{c.date === board.day ? 'Today' : c.date} · {new Date(c.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <button type="button" onClick={() => void board.approve(c, null)} className="flex-1 rounded-full bg-green-700 px-5 py-3 font-extrabold text-white sm:flex-none">Approve</button>
                  <button type="button" onClick={() => void board.reject(c)} className="flex-1 rounded-full border-2 border-line bg-white px-5 py-3 font-extrabold text-ink-2 sm:flex-none">Not yet</button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black lg:text-3xl">Tasks & routines</h2>
          <div className="flex flex-wrap gap-2">
            {board.tasks.length === 0 && (
              <button type="button" disabled={busy} onClick={() => void addStarters()} className="rounded-full border-2 border-amber bg-white px-5 py-3 font-extrabold disabled:opacity-50">Add starter routines</button>
            )}
            <button type="button" onClick={() => { setConfirmDelete(false); setDraft(blank()) }} className="rounded-full bg-amber px-5 py-3 font-extrabold">+ New task</button>
          </div>
        </div>
        {board.tasks.length === 0 && (
          <p className="rounded-3xl border-2 border-dashed border-line p-5 font-bold text-muted">
            No tasks yet. "Add starter routines" creates morning, after-school and bedtime tasks for each child, sized to their age. Edit or delete any of them afterwards.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {board.tasks.map((t) => (
            <button key={t.id} type="button" onClick={() => edit(t)} className="flex items-center gap-4 rounded-3xl bg-white p-4 text-left">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sand text-ink-2"><TaskIcon name={t.icon} size={30} /></span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-lg font-extrabold">{t.title}</span>
                <span className="truncate text-sm font-bold text-muted">
                  {whoLabel(t)} · {WINDOWS.find((w) => w.id === t.time_window)?.label} · {daysLabel(t.days_of_week)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-amber-deep">{t.stars ? `★ ${t.stars}` : ''}{t.needs_approval ? ' · check' : ''}</span>
            </button>
          ))}
        </div>
      </section>

      {draft && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={() => setDraft(null)}>
          <form onSubmit={save} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-5 overflow-auto rounded-t-[28px] bg-cream p-5 sm:rounded-[32px] lg:p-8">
            <h2 className="text-2xl font-black lg:text-3xl">{draft.id ? 'Edit task' : 'New task'}</h2>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-extrabold text-muted">Task</span>
              <input id="task-title" autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Brush teeth" className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold" />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-extrabold text-muted">Icon</span>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
                {Object.entries(TASK_ICONS).map(([key, { label }]) => (
                  <button key={key} type="button" aria-label={label} aria-pressed={draft.icon === key} onClick={() => setDraft({ ...draft, icon: key })}
                    className={`flex aspect-square items-center justify-center rounded-2xl border-2 ${draft.icon === key ? 'border-ink bg-amber' : 'border-transparent bg-white'}`}>
                    <TaskIcon name={key} size={26} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-extrabold text-muted">Who</span>
              <div className="flex flex-wrap gap-2">
                {members.filter((m) => m.role !== 'guest').map((m) => {
                  const on = !draft.all_members && draft.assignee_ids.includes(m.id)
                  return (
                    <button key={m.id} type="button" aria-pressed={on} onClick={() => toggleAssignee(m)}
                      style={on ? { background: m.colour, borderColor: m.colour } : undefined}
                      className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 font-extrabold ${on ? 'text-white' : 'border-line bg-white text-ink-2'}`}>
                      {m.name}
                    </button>
                  )
                })}
                <button type="button" aria-pressed={draft.all_members} onClick={() => setDraft({ ...draft, all_members: !draft.all_members, assignee_ids: [] })}
                  className={`rounded-full border-2 px-4 py-2 font-extrabold ${draft.all_members ? 'border-green-700 bg-green-700 text-white' : 'border-line bg-white text-ink-2'}`}>
                  Everyone (anyone can tick)
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-extrabold text-muted">When</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WINDOWS.map((w) => (
                  <button key={w.id} type="button" aria-pressed={draft.time_window === w.id} onClick={() => setDraft({ ...draft, time_window: w.id })}
                    className={`rounded-2xl border-2 px-3 py-2.5 font-extrabold ${draft.time_window === w.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2'}`}>{w.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d, i) => {
                  const on = draft.days_of_week.includes(i)
                  return (
                    <button key={d} type="button" aria-pressed={on} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                      onClick={() => setDraft({ ...draft, days_of_week: on ? draft.days_of_week.filter((x) => x !== i) : [...draft.days_of_week, i] })}
                      className={`rounded-xl border-2 py-2.5 font-extrabold ${on ? 'border-amber bg-amber text-ink' : 'border-line bg-white text-faint'}`}>{d}</button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-extrabold text-muted">Stars</span>
                <button type="button" aria-label="Fewer stars" onClick={() => setDraft({ ...draft, stars: Math.max(0, draft.stars - 1) })} className="h-11 w-11 rounded-full border-2 border-line bg-white text-xl font-black">−</button>
                <span className="w-8 text-center text-2xl font-black tabular-nums">{draft.stars}</span>
                <button type="button" aria-label="More stars" onClick={() => setDraft({ ...draft, stars: Math.min(5, draft.stars + 1) })} className="h-11 w-11 rounded-full border-2 border-line bg-white text-xl font-black">+</button>
              </div>
              <label className="flex items-center gap-3 font-extrabold">
                <input type="checkbox" checked={draft.needs_approval} onChange={(e) => setDraft({ ...draft, needs_approval: e.target.checked })} className="h-6 w-6 accent-amber-600" />
                A grown-up checks it before stars are given
              </label>
            </div>

            <div className="flex flex-wrap justify-between gap-3 border-t-2 border-sand pt-4">
              {draft.id ? (
                confirmDelete ? (
                  <button type="button" onClick={() => void remove()} className="rounded-full bg-red-700 px-5 py-3 font-extrabold text-white">Yes, delete it</button>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full px-2 py-3 font-extrabold text-red-700">Delete task</button>
                )
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setDraft(null)} className="rounded-full border-2 border-line bg-white px-5 py-3 font-extrabold text-ink-2">Cancel</button>
                <button type="submit" disabled={!valid || busy} className="rounded-full bg-ink px-6 py-3 font-extrabold text-white disabled:opacity-40">{draft.id ? 'Save' : 'Add task'}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
