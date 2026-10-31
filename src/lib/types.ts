export type Role = 'parent' | 'kid' | 'guest'
export type ReadingLevel = 'icons' | 'text'

export interface FamilyMember {
  id: string
  name: string
  role: Role
  avatar: string | null
  colour: string
  pin_hash: string | null
  sort_order: number
  birthdate: string | null
  reading_level: ReadingLevel
}

export const MEMBER_COLOURS = ['#2BB3A0', '#F26B5B', '#8B6CE6', '#3E8EE0', '#2E9E63', '#F2A51A', '#B53E6E', '#6B7A1F'] as const

export function ageFromBirthdate(birthdate: string | null, today = new Date()): number | null {
  if (!birthdate) return null
  const b = new Date(birthdate)
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age
}

/** Pre-readers get icon-first tiles. */
export function defaultReadingLevel(age: number | null): ReadingLevel {
  return age !== null && age < 7 ? 'icons' : 'text'
}

export interface List {
  id: string
  name: string
  kind: 'grocery' | 'todo' | 'generic'
  sort_order: number
}

export interface ListItem {
  id: string
  list_id: string
  text: string
  category: string | null
  done: boolean
  done_at: string | null
  added_by: string | null
  created_at: string
}

export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Reminder {
  id: string
  text: string
  due_at: string
  recurrence_rule: Recurrence | null
  member_id: string | null
  snoozed_until: string | null
  dismissed_at: string | null
  created_at: string
}

export type TimeWindow = 'morning' | 'afternoon' | 'evening' | 'anytime'

export interface Task {
  id: string
  title: string
  icon: string | null
  assignee_ids: string[]
  all_members: boolean
  routine: string | null
  days_of_week: number[]
  time_window: TimeWindow
  time_at: string | null
  stars: number
  needs_approval: boolean
  active: boolean
  sort_order: number
}

export interface TaskCompletion {
  id: string
  task_id: string
  member_id: string
  date: string
  status: 'done' | 'awaiting_approval'
  approved_by: string | null
  completed_at: string
}

export interface StarEntry {
  id: string
  member_id: string
  date: string
  delta: number
  reason: string | null
  source: 'task' | 'routine_bonus' | 'streak' | 'manual' | 'reward_claim'
  completion_id: string | null
  bonus_key?: string | null
  created_at?: string
}

/** Local calendar date as YYYY-MM-DD (not UTC, so the board turns over at local midnight). */
export function todayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export interface Reward {
  id: string
  member_id: string
  name: string
  icon: string
  image_path: string | null
  /** Goal: stars needed in the balance. Surprise: lifetime stars at which it unlocks. */
  star_target: number
  is_surprise: boolean
  unlocked_at: string | null
  claimed_at: string | null
  created_at: string
}
