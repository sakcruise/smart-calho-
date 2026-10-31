import type { FamilyMember, TimeWindow } from '../../lib/types'

interface Starter {
  title: string
  icon: string
  time_window: TimeWindow
  stars: number
  days?: number[]
}

const WEEKDAYS = [1, 2, 3, 4, 5]

/** Pre-readers: one-word tasks, big icons. */
const LITTLE: Starter[] = [
  { title: 'Teeth', icon: 'teeth', time_window: 'morning', stars: 1 },
  { title: 'Get dressed', icon: 'dress', time_window: 'morning', stars: 1 },
  { title: 'Shoes on', icon: 'shoes', time_window: 'morning', stars: 1, days: WEEKDAYS },
  { title: 'Tidy toys', icon: 'tidy', time_window: 'afternoon', stars: 1 },
  { title: 'Pyjamas', icon: 'bed', time_window: 'evening', stars: 1 },
  { title: 'Teeth', icon: 'teeth', time_window: 'evening', stars: 1 },
  { title: 'Story time', icon: 'read', time_window: 'evening', stars: 1 },
]

/** Readers: fuller routines, school-day tasks on weekdays only. */
const BIG: Starter[] = [
  { title: 'Brush teeth', icon: 'teeth', time_window: 'morning', stars: 1 },
  { title: 'Get dressed', icon: 'dress', time_window: 'morning', stars: 1 },
  { title: 'Make your bed', icon: 'bed', time_window: 'morning', stars: 1 },
  { title: 'Pack school bag', icon: 'bag', time_window: 'morning', stars: 1, days: WEEKDAYS },
  { title: 'Homework', icon: 'homework', time_window: 'afternoon', stars: 2, days: WEEKDAYS },
  { title: 'Read for 10 minutes', icon: 'read', time_window: 'afternoon', stars: 2 },
  { title: 'Bath or shower', icon: 'bath', time_window: 'evening', stars: 1 },
  { title: 'Brush teeth', icon: 'teeth', time_window: 'evening', stars: 1 },
  { title: "Lay out tomorrow's clothes", icon: 'dress', time_window: 'evening', stars: 1, days: [0, 1, 2, 3, 4] },
]

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** Rows for the tasks table: a starter routine per child by reading level, plus two shared and one parent task. */
export function starterRows(members: FamilyMember[]) {
  const rows: Record<string, unknown>[] = []
  let order = 0
  for (const kid of members.filter((m) => m.role === 'kid')) {
    const little = kid.reading_level === 'icons'
    for (const s of little ? LITTLE : BIG) {
      rows.push({
        title: s.title, icon: s.icon, time_window: s.time_window, stars: s.stars,
        days_of_week: s.days ?? ALL_DAYS, assignee_ids: [kid.id], all_members: false,
        needs_approval: little, sort_order: order++,
      })
    }
  }
  rows.push({ title: 'Tidy the living room', icon: 'home', time_window: 'afternoon', stars: 2, days_of_week: ALL_DAYS, assignee_ids: [], all_members: true, needs_approval: false, sort_order: order++ })
  rows.push({ title: 'Set the table', icon: 'breakfast', time_window: 'evening', stars: 1, days_of_week: ALL_DAYS, assignee_ids: [], all_members: true, needs_approval: false, sort_order: order++ })
  const parents = members.filter((m) => m.role === 'parent')
  if (parents.length) {
    rows.push({ title: 'Check school bags', icon: 'bag', time_window: 'morning', stars: 0, days_of_week: WEEKDAYS, assignee_ids: parents.map((p) => p.id), all_members: false, needs_approval: false, sort_order: order++ })
  }
  return rows
}
