import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { todayKey, type FamilyMember, type Task, type TaskCompletion, type TimeWindow } from '../../lib/types'

export type Routine = Exclude<TimeWindow, 'anytime'>

export const ROUTINES: { id: Routine; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'After school' },
  { id: 'evening', label: 'Bedtime' },
]

export function currentRoutine(d = new Date()): Routine {
  const h = d.getHours()
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

/** Is this task on today's board for the given routine? "anytime" tasks show in every routine. */
export function isScheduled(t: Task, routine: Routine | 'all', d = new Date()): boolean {
  if (!t.active || !t.days_of_week.includes(d.getDay())) return false
  return routine === 'all' || t.time_window === 'anytime' || t.time_window === routine
}

/** Members this task belongs to: its assignees, or everyone when all_members is set. */
export function assigneesOf(t: Task, members: FamilyMember[]): FamilyMember[] {
  return t.all_members ? members : members.filter((m) => t.assignee_ids.includes(m.id))
}

/**
 * Tasks, today's completions and star totals, all live.
 * A completion belongs to one date, so a new day starts with a clean board.
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [stars, setStars] = useState<Record<string, number>>({})
  const [day, setDay] = useState(todayKey)

  // Roll over at midnight
  useEffect(() => {
    const id = setInterval(() => { const k = todayKey(); setDay((d) => (d === k ? d : k)) }, 30000)
    return () => clearInterval(id)
  }, [])

  const loadTasks = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('tasks').select('*').order('sort_order').order('created_at')
    setTasks((data as Task[]) ?? [])
  }, [])

  const loadCompletions = useCallback(async () => {
    if (!supabase) return
    // Today's ticks plus anything still waiting for approval from earlier days
    const { data } = await supabase.from('task_completions').select('*').or(`date.eq.${day},status.eq.awaiting_approval`)
    setCompletions((data as TaskCompletion[]) ?? [])
  }, [day])

  const loadStars = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('star_balances').select('member_id, stars')
    const map: Record<string, number> = {}
    for (const r of (data as { member_id: string; stars: number }[]) ?? []) map[r.member_id] = r.stars
    setStars(map)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void loadTasks(); void loadCompletions(); void loadStars()
    const suffix = Math.random().toString(36).slice(2)
    const channel = client
      .channel(`tasks-board:${suffix}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => void loadTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, () => void loadCompletions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'star_ledger' }, () => void loadStars())
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [loadTasks, loadCompletions, loadStars])

  const completionFor = useCallback(
    (taskId: string, memberId: string) => completions.find((c) => c.task_id === taskId && c.member_id === memberId && c.date === day),
    [completions, day],
  )

  /** Someone completed a shared task today (shared tasks are done once, by anyone). */
  const sharedCompletion = useCallback(
    (taskId: string) => completions.find((c) => c.task_id === taskId && c.date === day),
    [completions, day],
  )

  const pending = useMemo(() => completions.filter((c) => c.status === 'awaiting_approval'), [completions])

  async function awardStars(completionId: string, memberId: string, task: Task, date: string) {
    if (!supabase || task.stars <= 0) return
    await supabase.from('star_ledger').insert({ member_id: memberId, date, delta: task.stars, reason: task.title, source: 'task', completion_id: completionId })
  }

  /** Tick a task. Returns 'done' or 'awaiting_approval' so the board can celebrate the right way. */
  async function complete(task: Task, member: FamilyMember): Promise<'done' | 'awaiting_approval' | null> {
    if (!supabase) return null
    const status = task.needs_approval && member.role === 'kid' ? 'awaiting_approval' : 'done'
    const { data, error } = await supabase
      .from('task_completions')
      .insert({ task_id: task.id, member_id: member.id, date: day, status })
      .select()
      .single()
    if (error || !data) return null
    setCompletions((cs) => [...cs, data as TaskCompletion])
    if (status === 'done') await awardStars((data as TaskCompletion).id, member.id, task, day)
    return status
  }

  /** Untick: remove the completion and any stars it earned. */
  async function undo(completion: TaskCompletion) {
    if (!supabase) return
    setCompletions((cs) => cs.filter((c) => c.id !== completion.id))
    await supabase.from('star_ledger').delete().eq('completion_id', completion.id)
    await supabase.from('task_completions').delete().eq('id', completion.id)
  }

  async function approve(completion: TaskCompletion, approverId: string | null) {
    if (!supabase) return
    const task = tasks.find((t) => t.id === completion.task_id)
    await supabase.from('task_completions').update({ status: 'done', approved_by: approverId }).eq('id', completion.id)
    if (task) await awardStars(completion.id, completion.member_id, task, completion.date)
  }

  async function reject(completion: TaskCompletion) {
    if (!supabase) return
    await supabase.from('task_completions').delete().eq('id', completion.id)
  }

  return { tasks, completions, stars, day, pending, completionFor, sharedCompletion, complete, undo, approve, reject }
}
