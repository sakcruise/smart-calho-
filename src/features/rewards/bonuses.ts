import { supabase } from '../../lib/supabase'
import { getSetting } from '../../lib/settings'
import { todayKey, type Task, type TaskCompletion } from '../../lib/types'
import { ROUTINE_NAMES, personalTasksOn, streaks } from './streaks'

interface StarRules { routine_bonus: number; streak_days: number; streak_bonus: number }
const DEFAULT_RULES: StarRules = { routine_bonus: 1, streak_days: 7, streak_bonus: 3 }

/**
 * Re-check a child's bonuses for one day straight from the database, then add or remove them.
 * Bonuses use only approved ("done") ticks. bonus_key is unique, so two screens can't award twice.
 */
export async function syncBonuses(memberId: string, date = todayKey()) {
  if (!supabase) return
  const { data: member } = await supabase.from('family_members').select('role').eq('id', memberId).maybeSingle()
  if (!member || (member as { role: string }).role !== 'kid') return // bonuses are for children
  const rules = { ...DEFAULT_RULES, ...(await getSetting<Partial<StarRules>>('star_rules', {})) }
  const since = new Date(); since.setDate(since.getDate() - 90)
  const [{ data: taskRows }, { data: compRows }] = await Promise.all([
    supabase.from('tasks').select('*').eq('active', true),
    supabase.from('task_completions').select('*').eq('member_id', memberId).gte('date', todayKey(since)),
  ])
  const tasks = (taskRows as Task[]) ?? []
  const completions = (compRows as TaskCompletion[]) ?? []
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, m - 1, d)
  const doneIds = new Set(completions.filter((c) => c.date === date && c.status === 'done').map((c) => c.task_id))

  const want: { key: string; delta: number; reason: string; source: 'routine_bonus' | 'streak' }[] = []
  const drop: string[] = []

  for (const w of ['morning', 'afternoon', 'evening'] as const) {
    const key = `${memberId}:${date}:routine:${w}`
    const list = personalTasksOn(tasks, memberId, day).filter((t) => t.time_window === w)
    if (list.length > 0 && list.every((t) => doneIds.has(t.id)) && rules.routine_bonus > 0) {
      want.push({ key, delta: rules.routine_bonus, reason: ROUTINE_NAMES[w], source: 'routine_bonus' })
    } else drop.push(key)
  }

  const streakKey = `${memberId}:${date}:streak`
  const s = streaks(tasks, completions, memberId, 90, day, true)
  if (s.todayComplete && s.current > 0 && rules.streak_days > 0 && s.current % rules.streak_days === 0 && rules.streak_bonus > 0) {
    want.push({ key: streakKey, delta: rules.streak_bonus, reason: `${s.current}-day streak`, source: 'streak' })
  } else drop.push(streakKey)

  if (want.length) {
    await supabase.from('star_ledger').upsert(
      want.map((b) => ({ member_id: memberId, date, delta: b.delta, reason: b.reason, source: b.source, bonus_key: b.key })),
      { onConflict: 'bonus_key', ignoreDuplicates: true },
    )
  }
  if (drop.length) await supabase.from('star_ledger').delete().in('bonus_key', drop)
}
