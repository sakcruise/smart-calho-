import { todayKey, type Task, type TaskCompletion, type TimeWindow } from '../../lib/types'

/** The member's own tasks (not shared ones) that were on the board on a given date. */
export function personalTasksOn(tasks: Task[], memberId: string, date: Date): Task[] {
  return tasks.filter((t) => t.active && !t.all_members && t.assignee_ids.includes(memberId) && t.days_of_week.includes(date.getDay()))
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** A day counts when every personal task was ticked (done or waiting for approval). Days with no tasks don't count or break. */
export function dayStatus(tasks: Task[], completions: TaskCompletion[], memberId: string, key: string, doneOnly = false): 'complete' | 'incomplete' | 'empty' {
  const list = personalTasksOn(tasks, memberId, dateFromKey(key))
  if (list.length === 0) return 'empty'
  const ticked = new Set(completions.filter((c) => c.member_id === memberId && c.date === key && (!doneOnly || c.status === 'done')).map((c) => c.task_id))
  return list.every((t) => ticked.has(t.id)) ? 'complete' : 'incomplete'
}

/**
 * Current streak: consecutive complete days ending today (or yesterday, so an unfinished today doesn't
 * break it before bedtime). Best streak: the longest run in the window loaded.
 */
export function streaks(tasks: Task[], completions: TaskCompletion[], memberId: string, days = 90, now = new Date(), doneOnly = false) {
  const keys: string[] = []
  for (let i = 0; i < days; i++) { const d = new Date(now); d.setDate(now.getDate() - i); keys.push(todayKey(d)) }
  const statuses = keys.map((k) => dayStatus(tasks, completions, memberId, k, doneOnly))

  let current = 0
  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i]
    if (s === 'empty') continue
    if (s === 'complete') current++
    else if (i === 0) continue // today still in progress
    else break
  }

  let best = 0
  let run = 0
  for (let i = statuses.length - 1; i >= 0; i--) {
    const s = statuses[i]
    if (s === 'empty') continue
    run = s === 'complete' ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { current, best, todayComplete: statuses[0] === 'complete' }
}

export const ROUTINE_NAMES: Record<Exclude<TimeWindow, 'anytime'>, string> = {
  morning: 'Morning routine', afternoon: 'After-school routine', evening: 'Bedtime routine',
}
